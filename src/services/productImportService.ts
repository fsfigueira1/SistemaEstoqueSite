// Importação de produtos por planilha: cria o que é novo, atualiza o que já
// existe (pelo código de barras) e lança a entrada no estoque — uma vez só por
// planilha (a mesma planilha importada de novo não soma o estoque de novo).
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { getSystemUserId } from "@/lib/systemUser"
import { importKey, normName, type ImportRow } from "@/lib/productImport"

export type PreviewItem = {
  line: number
  status: "new" | "update" | "error"
  productId?: string
  currentName?: string
  currentStock?: number
  currentPrice?: number
  /** Esta planilha já lançou o estoque deste produto antes. */
  alreadyImported?: boolean
  message?: string
}

export type ImportResult = {
  key: string
  created: number
  updated: number
  unitsAdded: number
  stockSkipped: number
  errors: Array<{ line: number; message: string }>
}

const MAX_ROWS = 2000
const round2 = (n: number) => Math.round(n * 100) / 100

/** Limpa o que veio do navegador (nunca confiar no formato). */
export function sanitizeRows(input: unknown): ImportRow[] {
  if (!Array.isArray(input)) throw new Error("Planilha vazia")
  if (input.length > MAX_ROWS) throw new Error(`Planilha grande demais (máx. ${MAX_ROWS} linhas)`)
  const n = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null
    const x = Number(v)
    return Number.isFinite(x) && x >= 0 ? round2(x) : null
  }
  const str = (v: unknown, max: number) => {
    const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""
    return s ? s.slice(0, max) : null
  }
  return input.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const market = (r.market ?? null) as Record<string, unknown> | null
    return {
      line: Number(r.line) || i + 2,
      barcode: str(r.barcode, 64)?.replace(/\s/g, "") ?? null,
      sku: str(r.sku, 64),
      name: str(r.name, 200) ?? "",
      category: str(r.category, 80),
      supplier: str(r.supplier, 120),
      qty: Math.min(100_000, Math.max(0, Math.round(Number(r.qty) || 0))),
      cost: n(r.cost),
      price: n(r.price),
      minStock: r.minStock == null ? null : Math.min(100_000, Math.max(0, Math.round(Number(r.minStock) || 0))),
      description: str(r.description, 500),
      market: market && n(market.median) != null ? { min: n(market.min), median: n(market.median), max: n(market.max) } : null,
      sources: Array.isArray(r.sources)
        ? (r.sources as unknown[]).filter((s): s is string => typeof s === "string" && /^https?:\/\//.test(s)).slice(0, 8)
        : [],
    }
  })
}

function rowError(r: ImportRow, seen: Set<string>): string | null {
  if (!r.name) return "Falta o nome"
  const code = r.barcode ?? r.sku
  if (!code) return "Falta o código de barras"
  if (seen.has(code)) return "Código repetido na planilha"
  seen.add(code)
  return null
}

async function findExisting(r: ImportRow) {
  const code = r.barcode ?? r.sku
  if (!code) return null
  return prisma.product.findFirst({
    where: r.barcode ? { OR: [{ barcode: r.barcode }, { sku: r.barcode }] } : { sku: code },
    select: { id: true, name: true, stockQuantity: true, salePrice: true },
  })
}

export async function previewImport(rows: ImportRow[]) {
  await ensureSchema()
  const key = importKey(rows)
  const ref = `IMPORT:${key}`
  const seen = new Set<string>()
  const items: PreviewItem[] = []
  for (const r of rows) {
    const err = rowError(r, seen)
    if (err) {
      items.push({ line: r.line, status: "error", message: err })
      continue
    }
    const p = await findExisting(r)
    if (!p) {
      items.push({ line: r.line, status: "new" })
      continue
    }
    const done = await prisma.stockMovement.findFirst({ where: { productId: p.id, reference: ref }, select: { id: true } })
    items.push({
      line: r.line,
      status: "update",
      productId: p.id,
      currentName: p.name,
      currentStock: p.stockQuantity,
      currentPrice: Number(p.salePrice),
      alreadyImported: Boolean(done),
    })
  }
  const [cats, sups] = await Promise.all([
    prisma.category.findMany({ select: { name: true } }),
    prisma.supplier.findMany({ select: { name: true } }),
  ])
  const have = (list: Array<{ name: string }>) => new Set(list.map((c) => normName(c.name)))
  const catSet = have(cats)
  const supSet = have(sups)
  const uniq = (xs: Array<string | null>, set: Set<string>) => [
    ...new Map(xs.filter((x): x is string => Boolean(x) && !set.has(normName(x as string))).map((x) => [normName(x), x])).values(),
  ]
  return {
    key,
    items,
    newCategories: uniq(rows.map((r) => r.category), catSet),
    newSuppliers: uniq(rows.map((r) => r.supplier), supSet),
  }
}

/** Acha pelo nome (sem acento/maiúscula) ou cria. */
async function resolver(kind: "category" | "supplier") {
  const list =
    kind === "category"
      ? await prisma.category.findMany({ select: { id: true, name: true } })
      : await prisma.supplier.findMany({ select: { id: true, name: true } })
  const byName = new Map(list.map((x) => [normName(x.name), x.id]))
  return async (name: string | null): Promise<string | null> => {
    if (!name) return null
    const k = normName(name)
    const found = byName.get(k)
    if (found) return found
    const created =
      kind === "category"
        ? await prisma.category.create({ data: { name }, select: { id: true } })
        : await prisma.supplier.create({ data: { name }, select: { id: true } })
    byName.set(k, created.id)
    return created.id
  }
}

export async function runImport(rows: ImportRow[]): Promise<ImportResult> {
  await ensureSchema()
  const key = importKey(rows)
  const ref = `IMPORT:${key}`
  const userId = await getSystemUserId()
  const category = await resolver("category")
  const supplier = await resolver("supplier")
  const fallbackCategory = async () => (await category("Sem categoria")) as string
  const result: ImportResult = { key, created: 0, updated: 0, unitsAdded: 0, stockSkipped: 0, errors: [] }
  const seen = new Set<string>()

  for (const r of rows) {
    const err = rowError(r, seen)
    if (err) {
      result.errors.push({ line: r.line, message: err })
      continue
    }
    try {
      const categoryId = (await category(r.category)) ?? null
      const supplierId = await supplier(r.supplier)
      const existing = await findExisting(r)
      const productId = await prisma.$transaction(async (tx) => {
        let id: string
        let addStock = r.qty > 0
        if (!existing) {
          const p = await tx.product.create({
            data: {
              name: r.name,
              sku: r.barcode ?? (r.sku as string),
              barcode: r.barcode,
              categoryId: categoryId ?? (await fallbackCategory()),
              supplierId,
              costPrice: r.cost ?? 0,
              salePrice: r.price ?? 0,
              stockQuantity: r.qty,
              minStockLevel: r.minStock ?? 5,
              description: r.description,
            },
            select: { id: true },
          })
          id = p.id
          result.created++
        } else {
          id = existing.id
          const already = await tx.stockMovement.findFirst({ where: { productId: id, reference: ref }, select: { id: true } })
          if (already) {
            addStock = false
            if (r.qty > 0) result.stockSkipped++
          }
          const oldPrice = Number(existing.salePrice)
          await tx.product.update({
            where: { id },
            data: {
              name: r.name,
              ...(categoryId ? { categoryId } : {}),
              ...(supplierId ? { supplierId } : {}),
              ...(r.cost != null ? { costPrice: r.cost } : {}),
              ...(r.price != null ? { salePrice: r.price } : {}),
              ...(r.minStock != null ? { minStockLevel: r.minStock } : {}),
              ...(r.description ? { description: r.description } : {}),
              ...(addStock ? { stockQuantity: { increment: r.qty } } : {}),
            },
          })
          if (r.price != null && Math.abs(oldPrice - r.price) >= 0.005) {
            await tx.priceHistory.create({
              data: { productId: id, previousPrice: oldPrice, newPrice: r.price, changedById: userId, reason: "Importação de planilha" },
            })
          }
          result.updated++
        }
        if (addStock) {
          await tx.stockMovement.create({
            data: {
              productId: id,
              type: "PURCHASE",
              quantity: r.qty,
              reference: ref,
              notes: `Entrada pela importação de planilha${r.supplier ? ` — ${r.supplier}` : ""}`,
              performedById: userId,
            },
          })
          result.unitsAdded += r.qty
        }
        return id
      })

      // pesquisa de mercado que veio na planilha → alimenta o aviso "abaixo do mercado"
      if (r.market?.median != null) {
        await prisma.priceCheck.create({
          data: {
            provider: "planilha",
            productId,
            barcode: r.barcode,
            query: normName(r.name),
            productName: r.name,
            currentPrice: r.price,
            costPrice: r.cost,
            suggestedPrice: r.price,
            marketMin: r.market.min,
            marketMedian: r.market.median,
            marketMax: r.market.max,
            direction: "Pesquisa de mercado trazida na planilha de importação.",
            confidence: "media",
            sources: r.sources.map((url) => ({ loja: new URL(url).hostname.replace(/^www\./, ""), preco: 0, tipo: "online", url })),
          },
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push({
        line: r.line,
        message: /Unique constraint|P2002/i.test(msg) ? "Código já usado por outro produto" : "Não foi possível salvar esta linha",
      })
    }
  }

  await prisma.auditLog
    .create({
      data: {
        userId,
        action: "PRODUCTS_IMPORTED",
        entity: "Import",
        entityId: key,
        metadata: { created: result.created, updated: result.updated, unitsAdded: result.unitsAdded, errors: result.errors.length },
      },
    })
    .catch(() => {})
  return result
}
