// Listas escolares salvas: a loja confere a lista da escola uma vez na tela
// Lista Escolar e salva como "Escola – Série – Ano letivo". Depois o
// orçamento sai na hora (sistema, robô do WhatsApp e site) com o preço e o
// estoque de agora — nada de preço fica gravado na lista.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import {
  gradeKey,
  newListCode,
  normalizeGrade,
  savedLines,
  slugify,
  type SavedItemInput,
  type SavedQuoteLine,
} from "@/lib/savedLists"
import { CATALOG_SELECT, toCatalogProduct } from "@/services/schoolListService"

export type SchoolDTO = { id: string; name: string; slug: string }

export type SavedListSummary = {
  id: string
  code: string
  schoolId: string
  schoolName: string
  schoolSlug: string
  grade: string
  schoolYear: number
  itemCount: number
  active: boolean
  updatedAt: string
}

export type SaveListInput = {
  schoolName: string
  grade: string
  schoolYear: number
  sourceText: string
  items: SavedItemInput[]
}

const SUMMARY_INCLUDE = {
  school: { select: { name: true, slug: true } },
  _count: { select: { items: true } },
} as const

type SummaryRow = {
  id: string
  code: string
  schoolId: string
  grade: string
  schoolYear: number
  active: boolean
  updatedAt: Date
  school: { name: string; slug: string }
  _count: { items: number }
}

const toSummary = (l: SummaryRow): SavedListSummary => ({
  id: l.id,
  code: l.code,
  schoolId: l.schoolId,
  schoolName: l.school.name,
  schoolSlug: l.school.slug,
  grade: l.grade,
  schoolYear: l.schoolYear,
  itemCount: l._count.items,
  active: l.active,
  updatedAt: l.updatedAt.toISOString(),
})

// erro de "único" do Prisma no campo code (o adapter pode ou não trazer o nome do campo)
const isCodeClash = (err: unknown) => {
  const e = err as { code?: string; meta?: { target?: unknown } }
  if (e?.code !== "P2002") return false
  const target = JSON.stringify(e.meta?.target ?? "")
  return target === '""' || target.includes("code")
}

// o corpo vem da tela (JSON) — não confia nos tipos
function validateSaveInput(input: SaveListInput) {
  const schoolName = String(input?.schoolName ?? "").trim().replace(/\s+/g, " ")
  const slug = slugify(schoolName)
  const grade = normalizeGrade(String(input?.grade ?? ""))
  const schoolYear = Number(input?.schoolYear)
  const items = Array.isArray(input?.items) ? input.items : []
  if (!slug) throw new Error("Informe a escola")
  if (!grade) throw new Error("Informe a série")
  if (!Number.isInteger(schoolYear) || schoolYear < 2000 || schoolYear > 2100) throw new Error("Ano letivo inválido")
  if (!items.length) throw new Error("A lista está vazia")
  const rows = items.map((i, position) => ({
    position,
    raw: String(i?.raw ?? ""),
    text: String(i?.text ?? ""),
    qty: Math.max(1, Math.round(Number(i?.qty) || 1)),
    productId: typeof i?.productId === "string" && i.productId ? i.productId : null,
  }))
  return { schoolName, slug, grade, schoolYear, rows }
}

export const SavedListService = {
  async listSchools(): Promise<SchoolDTO[]> {
    await ensureSchema()
    return prisma.school.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } })
  },

  async saveList(input: SaveListInput): Promise<SavedListSummary> {
    await ensureSchema()
    const { schoolName, slug, grade, schoolYear, rows } = validateSaveInput(input)

    for (let attempt = 0; ; attempt++) {
      try {
        const id = await prisma.$transaction(async (tx) => {
          // mantém a grafia do primeiro cadastro (é o nome que o site e o robô mostram)
          const school = await tx.school.upsert({
            where: { slug },
            update: {},
            create: { name: schoolName, slug },
          })
          const key = gradeKey(grade)
          const sameYear = await tx.schoolList.findMany({ where: { schoolId: school.id, schoolYear } })
          const existing = sameYear.find((l) => gradeKey(l.grade) === key)
          const list = existing
            ? await tx.schoolList.update({
                where: { id: existing.id },
                data: { sourceText: String(input.sourceText ?? ""), active: true },
              })
            : await tx.schoolList.create({
                data: { schoolId: school.id, grade, schoolYear, code: newListCode(), sourceText: String(input.sourceText ?? "") },
              })
          await tx.schoolListItem.deleteMany({ where: { listId: list.id } })
          await tx.schoolListItem.createMany({ data: rows.map((r) => ({ ...r, listId: list.id })) })
          return list.id
        })
        const saved = await prisma.schoolList.findUniqueOrThrow({ where: { id }, include: SUMMARY_INCLUDE })
        return toSummary(saved)
      } catch (err) {
        if (attempt < 5 && isCodeClash(err)) continue
        throw err
      }
    }
  },

  async listSaved(): Promise<SavedListSummary[]> {
    await ensureSchema()
    const lists = await prisma.schoolList.findMany({
      include: SUMMARY_INCLUDE,
      orderBy: [{ school: { name: "asc" } }, { schoolYear: "desc" }, { grade: "asc" }],
    })
    return lists.map(toSummary)
  },

  /** Orçamento de uma lista salva, por id ou código ("L-3A7K"). */
  async getQuote(
    idOrCode: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<{ list: SavedListSummary; lines: SavedQuoteLine[]; sourceText: string } | null> {
    await ensureSchema()
    const key = String(idOrCode ?? "").trim()
    if (!key) return null
    const where = /^L-/i.test(key) ? { code: key.toUpperCase() } : { id: key }
    const list = await prisma.schoolList.findUnique({
      where,
      include: { ...SUMMARY_INCLUDE, items: { orderBy: { position: "asc" } } },
    })
    if (!list || (opts.activeOnly && !list.active)) return null
    const ids = [...new Set(list.items.map((i) => i.productId).filter((x): x is string => !!x))]
    const products = ids.length
      ? await prisma.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: CATALOG_SELECT })
      : []
    const catalog = new Map(products.map((p) => [p.id, toCatalogProduct(p)]))
    return { list: toSummary(list), lines: savedLines(list.items, catalog), sourceText: list.sourceText }
  },

  async setActive(id: string, active: boolean): Promise<void> {
    await ensureSchema()
    await prisma.schoolList.update({ where: { id }, data: { active } })
  },

  async remove(id: string): Promise<void> {
    await ensureSchema()
    await prisma.schoolList.delete({ where: { id } })
  },
}
