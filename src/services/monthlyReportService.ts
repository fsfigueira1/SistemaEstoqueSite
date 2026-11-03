// Relatório do mês (horário de Brasília): vendas, formas de pagamento, dia a
// dia, produtos mais vendidos e — o pedido da dona — todo ajuste manual de
// estoque com o motivo e a explicação de quem tirou (src/lib/stockReasons.ts),
// com o custo do que saiu sem ser vendido. Testado em tests/monthlyReportService.test.ts.
import { prisma } from "@/lib/prisma"
import { parseReasonNote } from "@/lib/stockReasons"
import { METHOD_OF, toNum } from "@/services/reportService"

const OUT_TYPES = ["ADJUSTMENT_OUT", "LOSS", "THEFT", "PURCHASE_RETURN"] as const
const IN_TYPES = ["ADJUSTMENT_IN", "CORRECTION"] as const
const TYPE_REASON: Record<string, string> = {
  LOSS: "Perda / quebra / vencido",
  THEFT: "Furto",
  PURCHASE_RETURN: "Devolução ao fornecedor",
  ADJUSTMENT_OUT: "Saída manual",
  ADJUSTMENT_IN: "Entrada manual",
  CORRECTION: "Correção",
}

export const isMonthKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

/** "2026-10" → início e fim do mês em Brasília. */
export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
  return { start: new Date(`${key}-01T00:00:00-03:00`), end: new Date(`${next}-01T00:00:00-03:00`) }
}

export const prevMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
}

const DAY_BRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })

export type StockAdjustment = {
  id: string
  at: Date
  product: string
  sku: string
  direction: "saida" | "entrada"
  quantity: number
  reason: string
  explanation: string
  /** custo do que saiu (quantidade × custo do produto) */
  cost: number
}

export type MonthlyReport = Awaited<ReturnType<typeof getMonthlyReport>>

async function salesTotals(start: Date, end: Date) {
  const r = await prisma.sale.aggregate({
    where: { status: "COMPLETED", createdAt: { gte: start, lt: end } },
    _count: { _all: true },
    _sum: { totalAmount: true, discountAmount: true },
  })
  return { count: r._count._all, revenue: toNum(r._sum.totalAmount), discount: toNum(r._sum.discountAmount) }
}

export async function getMonthlyReport(key: string, now = new Date()) {
  const { start, end } = monthRange(key)
  const prev = monthRange(prevMonth(key))
  // mês em andamento: compara com o mesmo trecho do mês anterior (dia 1 até hoje), não com ele inteiro
  const ongoing = now >= start && now < end
  const prevEnd = ongoing ? new Date(Math.min(prev.end.getTime(), prev.start.getTime() + (now.getTime() - start.getTime()))) : prev.end
  const done = { status: "COMPLETED" as const, createdAt: { gte: start, lt: end } }

  const [totals, previous, sales, payments, items, moves] = await Promise.all([
    salesTotals(start, end),
    salesTotals(prev.start, prevEnd),
    prisma.sale.findMany({ where: done, select: { createdAt: true, totalAmount: true } }),
    prisma.salePayment.findMany({ where: { status: "PAID", sale: done }, select: { method: true, amount: true } }),
    prisma.saleItem.findMany({ where: { sale: done }, select: { productId: true, productName: true, quantity: true, totalAmount: true, product: { select: { name: true } } } }),
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: start, lt: end }, type: { in: [...OUT_TYPES, ...IN_TYPES] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, quantity: true, notes: true, createdAt: true, product: { select: { name: true, sku: true, costPrice: true } } },
    }),
  ])

  // dia a dia (todos os dias do mês, mesmo sem venda)
  const byDay = new Map<string, { revenue: number; count: number }>()
  for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86_400_000)) byDay.set(DAY_BRT.format(d), { revenue: 0, count: 0 })
  for (const s of sales) {
    const k = DAY_BRT.format(s.createdAt)
    const cur = byDay.get(k) ?? { revenue: 0, count: 0 }
    cur.revenue += toNum(s.totalAmount)
    cur.count += 1
    byDay.set(k, cur)
  }

  const methods = { cash: 0, card: 0, pix: 0 }
  for (const p of payments) methods[METHOD_OF[p.method] ?? "cash"] += toNum(p.amount)

  const prod = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const i of items) {
    const k = i.productId ?? `avulso:${i.productName ?? ""}`
    const cur = prod.get(k) ?? { name: i.product?.name ?? i.productName ?? "Item avulso", quantity: 0, revenue: 0 }
    cur.quantity += i.quantity
    cur.revenue += toNum(i.totalAmount)
    prod.set(k, cur)
  }

  const adjustments: StockAdjustment[] = moves.map((m) => {
    const out = (OUT_TYPES as readonly string[]).includes(m.type)
    const { reason, explanation } = parseReasonNote(m.notes)
    return {
      id: m.id,
      at: m.createdAt,
      product: m.product.name,
      sku: m.product.sku,
      direction: out ? "saida" : "entrada",
      quantity: m.quantity,
      reason: reason ?? TYPE_REASON[m.type] ?? m.type,
      explanation: explanation || "(sem explicação)",
      cost: out ? m.quantity * toNum(m.product.costPrice) : 0,
    }
  })
  const outs = adjustments.filter((a) => a.direction === "saida")
  const byReason = new Map<string, { reason: string; quantity: number; cost: number; count: number }>()
  for (const a of outs) {
    const cur = byReason.get(a.reason) ?? { reason: a.reason, quantity: 0, cost: 0, count: 0 }
    cur.quantity += a.quantity
    cur.cost += a.cost
    cur.count += 1
    byReason.set(a.reason, cur)
  }

  return {
    month: key,
    sales: { ...totals, avgTicket: totals.count ? totals.revenue / totals.count : 0, previousRevenue: previous.revenue, ongoing },
    methods,
    days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    topProducts: [...prod.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    adjustments,
    adjustmentSummary: {
      outUnits: outs.reduce((s, a) => s + a.quantity, 0),
      outCost: outs.reduce((s, a) => s + a.cost, 0),
      inUnits: adjustments.filter((a) => a.direction === "entrada").reduce((s, a) => s + a.quantity, 0),
      byReason: [...byReason.values()].sort((a, b) => b.cost - a.cost),
    },
  }
}
