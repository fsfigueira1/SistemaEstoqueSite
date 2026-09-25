// Conferência do caixa (salvar) e histórico por dia.
// Ver as regras de dinheiro no topo de reportService.ts.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { healRefundedPayments } from "@/services/paymentHeal"
import { computeDifference, computeExpected, feeAmount, feeRatesOf, parseMoney, round2, type MethodTotals } from "@/lib/closing"
import { closingView, dateKey, emptyTotals, getDailyReport, METHOD_OF, toNum, type ClosingView } from "@/services/reportService"
import { getServerSettings } from "@/lib/serverSettings"

// ---------- conferência ----------
export type ClosingInput = {
  cashFloat?: number
  withdrawals?: number
  countedCash?: number | null
  countedCard?: number | null
  countedPix?: number | null
  notes?: string | null
}

export async function saveClosing(key: string, input: ClosingInput): Promise<ClosingView> {
  const report = await getDailyReport(key)
  const cashFloat = parseMoney(input.cashFloat) ?? 0
  const withdrawals = parseMoney(input.withdrawals) ?? 0
  const counted = {
    countedCash: parseMoney(input.countedCash),
    countedCard: parseMoney(input.countedCard),
    countedPix: parseMoney(input.countedPix),
  }
  const expected = computeExpected(report, cashFloat, withdrawals)
  const difference = computeDifference(expected, counted)
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 500) : null

  const data = { cashFloat, withdrawals, ...expected, ...counted, difference, notes }
  const saved = await prisma.dailyClosing.upsert({
    where: { date: key },
    update: data,
    create: { date: key, ...data },
  })
  return closingView(saved)
}

// ---------- histórico ----------
export type HistoryDay = {
  date: string
  salesCount: number
  revenue: number
  net: MethodTotals
  /** Taxas de cartão/Pix do dia (0 se não configuradas). */
  fees: number
  closing: { difference: number; counted: boolean } | null
}

export async function getHistory(days = 30): Promise<HistoryDay[]> {
  await ensureSchema()
  await healRefundedPayments()
  const rates = feeRatesOf(await getServerSettings())
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  const [sales, refundedPayments, closings] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: start }, status: { in: ["COMPLETED", "REFUNDED"] } },
      select: {
        status: true,
        totalAmount: true,
        createdAt: true,
        payments: { select: { method: true, amount: true, status: true, installmentCount: true } },
      },
    }),
    prisma.salePayment.findMany({
      where: {
        status: "REFUNDED",
        OR: [{ refundedAt: { gte: start } }, { refundedAt: null, updatedAt: { gte: start } }],
      },
      select: { method: true, amount: true, refundedAt: true, updatedAt: true, installmentCount: true },
    }),
    prisma.dailyClosing.findMany({ where: { date: { gte: dateKey(start) } } }),
  ])

  const map = new Map<string, HistoryDay>()
  const get = (k: string) => {
    let d = map.get(k)
    if (!d) {
      d = { date: k, salesCount: 0, revenue: 0, net: emptyTotals(), fees: 0, closing: null }
      map.set(k, d)
    }
    return d
  }
  for (const s of sales) {
    const d = get(dateKey(s.createdAt))
    for (const p of s.payments) {
      if (p.status === "PAID" || p.status === "REFUNDED") {
        d.net[METHOD_OF[p.method] ?? "cash"] += toNum(p.amount)
        d.fees += feeAmount(p.method, toNum(p.amount), p.installmentCount, rates)
      }
    }
    if (s.status === "COMPLETED") {
      d.salesCount += 1
      d.revenue += toNum(s.totalAmount)
    }
  }
  for (const p of refundedPayments) {
    const d = get(dateKey(p.refundedAt ?? p.updatedAt))
    d.net[METHOD_OF[p.method] ?? "cash"] -= toNum(p.amount)
    d.fees -= feeAmount(p.method, toNum(p.amount), p.installmentCount, rates)
  }
  for (const c of closings) {
    const d = get(c.date)
    d.closing = {
      difference: toNum(c.difference),
      counted: c.countedCash != null || c.countedCard != null || c.countedPix != null,
    }
  }
  return [...map.values()]
    .map((d) => ({
      ...d,
      revenue: round2(d.revenue),
      fees: round2(d.fees),
      net: { cash: round2(d.net.cash), card: round2(d.net.card), pix: round2(d.net.pix) },
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}
