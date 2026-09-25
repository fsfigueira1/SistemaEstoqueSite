// Relatório do dia + conferência do caixa (dinheiro, cartão e Pix).
//
// Regras do dinheiro:
//  - "Entrou" por forma = pagamentos das vendas feitas no dia (inclui as que
//    depois foram estornadas, porque o dinheiro entrou naquele dia).
//  - "Estornos" = pagamentos devolvidos no dia (data do estorno).
//  - Líquido = entrou − estornos. É o que deve bater com a gaveta, a
//    maquininha e o extrato do Pix.
//  - Dinheiro esperado na gaveta = fundo de troco + líquido em dinheiro − retiradas.
//
// Dias são contados no horário local do computador da loja (o servidor Next
// roda dentro do app Electron em cada PC).
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { healRefundedPayments } from "@/services/paymentHeal"
import { getServerSettings } from "@/lib/serverSettings"
import { feeAmount, feeRatesOf, hasFees, round2, type MethodKey, type MethodTotals } from "@/lib/closing"
import { buildInsights } from "@/lib/reportInsights"
import { getPriceAlerts } from "@/services/priceAdvisorService"

export type { MethodKey, MethodTotals }

export const METHOD_OF: Record<string, MethodKey> = {
  CASH: "cash",
  CREDIT_CARD: "card",
  DEBIT_CARD: "card",
  PIX: "pix",
}

export const toNum = (v: unknown): number => {
  if (v == null) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber: () => number }).toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ---------- datas ----------
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function isDateKey(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function dayRange(key: string): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
  return { start, end }
}

// ---------- tipos ----------
export type DailyReport = {
  date: string
  isToday: boolean
  salesCount: number
  revenue: number
  avgTicket: number
  itemsSold: number
  discounts: number
  cardInterest: number
  /** Entradas por forma (vendas do dia). */
  received: MethodTotals
  /** Estornos devolvidos no dia, por forma. */
  refunded: MethodTotals
  /** Líquido = entradas − estornos. */
  net: MethodTotals
  netTotal: number
  /** Taxas da maquininha/Pix (configuradas em Configurações) e o que cai na conta. */
  fees: { card: number; pix: number; total: number; configured: boolean }
  deposit: { card: number; pix: number }
  card: { credit: number; debit: number; installmentSales: number }
  refunds: { count: number; total: number }
  byHour: Array<{ hour: number; total: number; count: number }>
  topProducts: Array<{ name: string; quantity: number; total: number }>
  last7Avg: number
  closing: ClosingView | null
  cashFloatDefault: number
  insights: string[]
  alerts: Array<{ kind: "stock" | "price" | "closing"; text: string; href?: string }>
}

export type ClosingView = {
  date: string
  cashFloat: number
  withdrawals: number
  expectedCash: number
  expectedCard: number
  expectedPix: number
  countedCash: number | null
  countedCard: number | null
  countedPix: number | null
  difference: number
  notes: string | null
  closedAt: string
  updatedAt: string
}

export const emptyTotals = (): MethodTotals => ({ cash: 0, card: 0, pix: 0 })

export function closingView(c: {
  date: string
  cashFloat: unknown
  withdrawals: unknown
  expectedCash: unknown
  expectedCard: unknown
  expectedPix: unknown
  countedCash: unknown
  countedCard: unknown
  countedPix: unknown
  difference: unknown
  notes: string | null
  closedAt: Date
  updatedAt: Date
}): ClosingView {
  return {
    date: c.date,
    cashFloat: toNum(c.cashFloat),
    withdrawals: toNum(c.withdrawals),
    expectedCash: toNum(c.expectedCash),
    expectedCard: toNum(c.expectedCard),
    expectedPix: toNum(c.expectedPix),
    countedCash: c.countedCash == null ? null : toNum(c.countedCash),
    countedCard: c.countedCard == null ? null : toNum(c.countedCard),
    countedPix: c.countedPix == null ? null : toNum(c.countedPix),
    difference: toNum(c.difference),
    notes: c.notes,
    closedAt: c.closedAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

// ---------- relatório ----------
export async function getDailyReport(key: string): Promise<DailyReport> {
  await ensureSchema()
  await healRefundedPayments()
  const { start, end } = dayRange(key)
  const settings = await getServerSettings()

  const [sales, refundedPayments, closing, weekSales, lowStock] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: start, lt: end }, status: { in: ["COMPLETED", "REFUNDED"] } },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
        subtotal: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true, totalAmount: true, product: { select: { name: true } } } },
        payments: {
          select: { method: true, amount: true, status: true, installmentCount: true },
        },
      },
    }),
    prisma.salePayment.findMany({
      where: {
        status: "REFUNDED",
        OR: [
          { refundedAt: { gte: start, lt: end } },
          // estornos antigos (antes de gravarmos refundedAt) usam updatedAt
          { refundedAt: null, updatedAt: { gte: start, lt: end } },
        ],
      },
      select: { method: true, amount: true, installmentCount: true },
    }),
    prisma.dailyClosing.findUnique({ where: { date: key } }),
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7), lt: start },
      },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { stockQuantity: true, minStockLevel: true },
    }),
  ])

  const received = emptyTotals()
  const refunded = emptyTotals()
  const rates = feeRatesOf(settings)
  const fees = { card: 0, pix: 0 }
  const addFee = (method: string, amount: number, installments: number | null, sign: 1 | -1) => {
    const f = feeAmount(method, amount, installments, rates) * sign
    if (method === "PIX") fees.pix += f
    else if (method === "CREDIT_CARD" || method === "DEBIT_CARD") fees.card += f
  }
  const card = { credit: 0, debit: 0, installmentSales: 0 }
  const hours = new Map<number, { total: number; count: number }>()
  const products = new Map<string, { name: string; quantity: number; total: number }>()
  let revenue = 0
  let salesCount = 0
  let itemsSold = 0
  let discounts = 0
  let cardInterest = 0
  const refunds = { count: 0, total: 0 }

  for (const s of sales) {
    // dinheiro que entrou no dia (venda concluída ou estornada depois)
    for (const p of s.payments) {
      if (p.status !== "PAID" && p.status !== "REFUNDED") continue
      const k = METHOD_OF[p.method] ?? "cash"
      const amount = toNum(p.amount)
      received[k] += amount
      if (p.method === "CREDIT_CARD") card.credit += amount
      if (p.method === "DEBIT_CARD") card.debit += amount
      if ((p.installmentCount ?? 1) > 1) card.installmentSales += 1
      addFee(p.method, amount, p.installmentCount, 1)
    }

    if (s.status === "REFUNDED") {
      refunds.count += 1
      refunds.total += toNum(s.totalAmount)
      continue
    }

    const total = toNum(s.totalAmount)
    revenue += total
    salesCount += 1
    discounts += toNum(s.discountAmount)
    // juros do cartão = total − (subtotal − desconto), quando positivo
    cardInterest += Math.max(0, total - (toNum(s.subtotal) - toNum(s.discountAmount)))

    const h = s.createdAt.getHours()
    const hb = hours.get(h) ?? { total: 0, count: 0 }
    hb.total += total
    hb.count += 1
    hours.set(h, hb)

    for (const it of s.items) {
      const name = it.product?.name ?? it.productName ?? "Item avulso"
      const cur = products.get(name) ?? { name, quantity: 0, total: 0 }
      cur.quantity += it.quantity
      cur.total += toNum(it.totalAmount)
      products.set(name, cur)
      itemsSold += it.quantity
    }
  }

  for (const p of refundedPayments) {
    refunded[METHOD_OF[p.method] ?? "cash"] += toNum(p.amount)
    addFee(p.method, toNum(p.amount), p.installmentCount, -1)
  }

  const net: MethodTotals = {
    cash: round2(received.cash - refunded.cash),
    card: round2(received.card - refunded.card),
    pix: round2(received.pix - refunded.pix),
  }
  const netTotal = round2(net.cash + net.card + net.pix)

  // média dos 7 dias anteriores (só dias com venda)
  const perDay = new Map<string, number>()
  for (const s of weekSales) perDay.set(dateKey(s.createdAt), (perDay.get(dateKey(s.createdAt)) ?? 0) + toNum(s.totalAmount))
  const last7Avg = perDay.size ? [...perDay.values()].reduce((a, b) => a + b, 0) / perDay.size : 0

  const byHour = [...hours.entries()]
    .map(([hour, v]) => ({ hour, total: round2(v.total), count: v.count }))
    .sort((a, b) => a.hour - b.hour)
  const topProducts = [...products.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((p) => ({ ...p, total: round2(p.total) }))

  const insights = buildInsights({
    salesCount,
    revenue,
    net,
    netTotal,
    byHour,
    topProducts,
    topByQuantity: [...products.values()].sort((x, y) => y.quantity - x.quantity)[0] ?? null,
    last7Avg,
    refunds,
    feesTotal: hasFees(rates) ? fees.card + fees.pix : 0,
  })

  // ---------- avisos ----------
  const alerts: DailyReport["alerts"] = []
  const isToday = key === dateKey(new Date())
  if (!closing && salesCount > 0) {
    alerts.push({ kind: "closing", text: "Caixa ainda não conferido." })
  }
  const low = lowStock.filter((p) => p.stockQuantity <= (p.minStockLevel ?? 5)).length
  if (low > 0 && isToday) {
    alerts.push({ kind: "stock", text: `${low} ${low === 1 ? "produto precisa" : "produtos precisam"} de reposição.`, href: "/estoque" })
  }
  if (isToday) {
    const rising = (await getPriceAlerts()).length
    if (rising > 0) {
      alerts.push({
        kind: "price",
        text: `${rising} ${rising === 1 ? "produto está" : "produtos estão"} abaixo do preço de mercado.`,
        href: "/produtos?alerta=preco",
      })
    }
  }

  return {
    date: key,
    isToday,
    salesCount,
    revenue: round2(revenue),
    avgTicket: salesCount ? round2(revenue / salesCount) : 0,
    itemsSold,
    discounts: round2(discounts),
    cardInterest: round2(cardInterest),
    received: { cash: round2(received.cash), card: round2(received.card), pix: round2(received.pix) },
    refunded: { cash: round2(refunded.cash), card: round2(refunded.card), pix: round2(refunded.pix) },
    net,
    netTotal,
    fees: {
      card: round2(fees.card),
      pix: round2(fees.pix),
      total: round2(fees.card + fees.pix),
      configured: hasFees(rates),
    },
    deposit: { card: round2(net.card - fees.card), pix: round2(net.pix - fees.pix) },
    card: { credit: round2(card.credit), debit: round2(card.debit), installmentSales: card.installmentSales },
    refunds: { count: refunds.count, total: round2(refunds.total) },
    byHour,
    topProducts,
    last7Avg: round2(last7Avg),
    closing: closing ? closingView(closing) : null,
    cashFloatDefault: settings.cashFloatDefault ?? 0,
    insights,
    alerts,
  }
}
