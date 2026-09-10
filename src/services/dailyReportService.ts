import { prisma } from "../lib/prisma"
import { SaleStatus } from "../generated/prisma/client.ts"
import { SaleService } from "./saleService"
import { brtDayRange } from "../lib/brtDay"

type Stats = {
  count: number
  totals: { totalAmount: number }
  averages: { totalAmount: number | null }
}

export type DailySummary = {
  totalAmount: number
  salesCount: number
  averageTicket: number
}

/** Molda o retorno de SaleService.getSalesStatistics no formato do relatório. */
export function summarizeStats(stats: Stats): DailySummary {
  return {
    salesCount: stats.count,
    totalAmount: stats.totals.totalAmount ?? 0,
    averageTicket: stats.averages.totalAmount ?? 0,
  }
}

// Classe estática seguindo o padrão dos outros services do projeto.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DailyReportService {
  /**
   * Calcula o resumo de vendas COMPLETED do dia civil BRT `day` ("YYYY-MM-DD")
   * e grava (upsert idempotente por data) em `daily_reports`.
   */
  static async generateForDate(day: string) {
    const { start, end } = brtDayRange(day)
    // brtDayRange é semiaberto [start, end); getSalesStatistics usa `lte`,
    // então recuamos 1ms pra não contar uma venda na meia-noite do dia seguinte.
    const stats = await SaleService.getSalesStatistics({
      status: SaleStatus.COMPLETED,
      startDate: start,
      endDate: new Date(end.getTime() - 1),
    })
    const summary = summarizeStats(stats as Stats)
    const date = new Date(`${day}T00:00:00.000Z`)

    return prisma.dailyReport.upsert({
      where: { date },
      create: { date, generatedAt: new Date(), ...summary },
      update: { generatedAt: new Date(), ...summary },
    })
  }

  /** Os `limit` relatórios mais recentes, data desc. */
  static async list(limit = 90) {
    return prisma.dailyReport.findMany({ orderBy: { date: "desc" }, take: limit })
  }

  /** Um relatório por dia civil BRT, ou null. */
  static async getByDate(day: string) {
    const date = new Date(`${day}T00:00:00.000Z`)
    return prisma.dailyReport.findUnique({ where: { date } })
  }
}
