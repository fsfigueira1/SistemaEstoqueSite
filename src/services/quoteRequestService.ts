// Orçamentos pedidos: cada orçamento montado no atendimento (copiloto do
// WhatsApp) ou na Lista Escolar fica salvo com nome e telefone, para achar
// quando a pessoa chega na loja. Guarda o preço do momento; o detalhe mostra
// também o preço e o estoque de agora. Testado em tests/quoteRequestService.test.ts.
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { whatsappNumber } from "@/lib/restock"
import { norm } from "@/lib/schoolList"
import { toNum } from "@/services/reportService"

export type QuoteItem = { qty: number; text: string; productId: string | null; price: number | null; take: number }
export const QUOTE_STATUSES = ["aberto", "separado", "retirado", "cancelado"] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export type QuoteSummary = {
  id: string
  name: string
  phone: string | null
  title: string
  total: number
  status: string
  source: string
  createdAt: string
  itemCount: number
}

export type QuoteDetail = QuoteSummary & {
  items: Array<QuoteItem & { now: { price: number; stock: number; active: boolean; name: string; code: string } | null }>
  toConfirm: string[]
  message: string
}

type CreateInput = {
  name: string
  phone: string | null
  source: "whatsapp" | "balcao"
  title: string
  items: QuoteItem[]
  toConfirm: string[]
  total: number
  message: string
}

const asItems = (v: unknown): QuoteItem[] => (Array.isArray(v) ? (v as QuoteItem[]) : [])
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

const summary = (q: {
  id: string
  name: string
  phone: string | null
  title: string
  total: unknown
  status: string
  source: string
  createdAt: Date
  items: unknown
}): QuoteSummary => ({
  id: q.id,
  name: q.name,
  phone: q.phone,
  title: q.title,
  total: Math.round(toNum(q.total) * 100) / 100,
  status: q.status,
  source: q.source,
  createdAt: q.createdAt.toISOString(),
  itemCount: asItems(q.items).length,
})

export const QuoteRequestService = {
  async create(input: CreateInput): Promise<{ id: string }> {
    await ensureSchema()
    const phone = whatsappNumber(input.phone)
    const name = String(input.name ?? "").trim().slice(0, 120)
    const q = await prisma.quoteRequest.create({
      data: {
        name,
        phone,
        source: input.source,
        title: String(input.title ?? "").slice(0, 200),
        items: input.items as unknown as Prisma.InputJsonValue,
        toConfirm: input.toConfirm,
        total: Math.round(Number(input.total || 0) * 100) / 100,
        message: String(input.message ?? "").slice(0, 8000),
      },
    })
    // o número entra nos Contatos como "não respondeu SIM"; quem já existe não muda
    if (phone) {
      await prisma.contact.createMany({ data: [{ phone, name: name || null, source: "whatsapp" }], skipDuplicates: true })
    }
    return { id: q.id }
  },

  async list(opts: { q?: string; status?: string }): Promise<QuoteSummary[]> {
    await ensureSchema()
    const status = QUOTE_STATUSES.includes(opts.status as QuoteStatus) ? opts.status : undefined
    const rows = await prisma.quoteRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    const text = norm(String(opts.q ?? "").trim())
    const digits = String(opts.q ?? "").replace(/\D/g, "")
    const filtered = text
      ? rows.filter((r) => norm(r.name).includes(text) || (digits.length >= 4 && (r.phone ?? "").includes(digits)))
      : rows
    return filtered.slice(0, 200).map(summary)
  },

  async get(id: string): Promise<QuoteDetail | null> {
    await ensureSchema()
    const q = await prisma.quoteRequest.findUnique({ where: { id } })
    if (!q) return null
    const items = asItems(q.items)
    const ids = [...new Set(items.map((i) => i.productId).filter((x): x is string => !!x))]
    const products = ids.length
      ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, salePrice: true, stockQuantity: true, status: true, barcode: true, sku: true } })
      : []
    const byId = new Map(products.map((p) => [p.id, p]))
    return {
      ...summary(q),
      items: items.map((i) => {
        const p = i.productId ? byId.get(i.productId) : undefined
        return {
          ...i,
          now: p ? { price: Math.round(toNum(p.salePrice) * 100) / 100, stock: p.stockQuantity, active: p.status === "ACTIVE", name: p.name, code: p.barcode || p.sku } : null,
        }
      }),
      toConfirm: asStrings(q.toConfirm),
      message: q.message,
    }
  },

  async setStatus(id: string, status: string): Promise<void> {
    await ensureSchema()
    if (!QUOTE_STATUSES.includes(status as QuoteStatus)) throw new Error("Situação inválida")
    await prisma.quoteRequest.update({ where: { id }, data: { status } })
  },
}
