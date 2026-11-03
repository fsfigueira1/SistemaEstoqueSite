// Gráficos do Painel (horário de Brasília): últimos 35 dias (tendência e mapa
// de calor), horário de pico, comparações (hoje x mesma dia da semana passada,
// mês até hoje x mesmo trecho do mês anterior) e, do relatório do mês, formas
// de pagamento e mais vendidos. Testado em tests/dashboardChartsService.test.ts.
import { prisma } from "@/lib/prisma"
import { toNum } from "@/services/reportService"
import { getMonthlyReport, monthRange, prevMonth } from "@/services/monthlyReportService"
import { StockService } from "@/services/stockService"

const DAY = 86_400_000
const DAYS = 35
const DAY_BRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
const HOUR_BRT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" })

const dayStart = (key: string) => new Date(`${key}T00:00:00-03:00`)

export async function getDashboardCharts(now = new Date()) {
  const todayKey = DAY_BRT.format(now)
  const from = new Date(dayStart(todayKey).getTime() - (DAYS - 1) * DAY)
  const monthKey = todayKey.slice(0, 7)

  // mesmo trecho do mês anterior (dia 1 até o dia de hoje, no mês passado)
  const prev = monthRange(prevMonth(monthKey))
  const prevCut = new Date(Math.min(prev.start.getTime() + (now.getTime() - monthRange(monthKey).start.getTime()), prev.end.getTime()))

  const [sales, month, prevToDate, low, out] = await Promise.all([
    prisma.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: from } }, select: { createdAt: true, totalAmount: true } }),
    getMonthlyReport(monthKey, now),
    prisma.sale.aggregate({ where: { status: "COMPLETED", createdAt: { gte: prev.start, lt: prevCut } }, _sum: { totalAmount: true } }),
    StockService.getLowStockProducts(),
    StockService.getOutOfStockProducts(),
  ])

  const days = new Map<string, { revenue: number; count: number }>()
  for (let i = 0; i < DAYS; i++) days.set(DAY_BRT.format(new Date(from.getTime() + i * DAY + 12 * 3_600_000)), { revenue: 0, count: 0 })
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }))
  for (const s of sales) {
    const v = toNum(s.totalAmount)
    const d = days.get(DAY_BRT.format(s.createdAt))
    if (d) {
      d.revenue += v
      d.count += 1
    }
    const h = hours[Number(HOUR_BRT.format(s.createdAt)) % 24]
    h.revenue += v
    h.count += 1
  }
  const series = [...days.entries()].map(([date, v]) => ({ date, ...v }))
  const today = days.get(todayKey) ?? { revenue: 0, count: 0 }
  const lastWeek = days.get(DAY_BRT.format(new Date(now.getTime() - 7 * DAY))) ?? { revenue: 0, count: 0 }
  // horário de pico: só a faixa em que a loja vende (sem as madrugadas vazias)
  const open = hours.filter((h) => h.count > 0)
  const first = open.length ? Math.min(...open.map((h) => h.hour)) : 8
  const last = open.length ? Math.max(...open.map((h) => h.hour)) : 18

  return {
    today: { ...today, avgTicket: today.count ? today.revenue / today.count : 0, lastWeek: lastWeek.revenue },
    month: {
      revenue: month.sales.revenue,
      count: month.sales.count,
      prevToDate: toNum(prevToDate._sum.totalAmount),
      methods: month.methods,
      topProducts: month.topProducts.slice(0, 6),
      lostCost: month.adjustmentSummary.outCost,
    },
    days: series,
    hours: hours.filter((h) => h.hour >= first && h.hour <= last),
    restock: {
      low: low.length,
      out: out.length,
      list: low.slice(0, 7).map((p) => ({ id: p.id, name: p.name, stock: p.stockQuantity, min: p.minStockLevel })),
    },
  }
}
