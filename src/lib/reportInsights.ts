// Falas da assistente no relatório do dia — texto curto, direto, em português.
// Função pura (sem banco) para dar para testar.
import { METHOD_LABEL, type MethodKey, type MethodTotals } from "@/lib/closing"

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
const pct = (v: number) => `${Math.round(v * 100)}%`

export type InsightInput = {
  salesCount: number
  revenue: number
  net: MethodTotals
  netTotal: number
  byHour: Array<{ hour: number; total: number }>
  topProducts: Array<{ name: string; total: number }>
  topByQuantity: { name: string; quantity: number } | null
  last7Avg: number
  refunds: { count: number; total: number }
  /** Taxas de cartão/Pix do dia (0 se não configuradas). */
  feesTotal?: number
}

export function buildInsights(d: InsightInput): string[] {
  const out: string[] = []
  if (d.salesCount === 0) {
    out.push("Nenhuma venda registrada neste dia.")
  } else {
    out.push(
      `${d.salesCount} ${d.salesCount === 1 ? "venda" : "vendas"}, somando ${brl(d.revenue)}. Ticket médio de ${brl(d.revenue / d.salesCount)}.`,
    )
    const methods = (Object.keys(d.net) as MethodKey[]).filter((k) => d.net[k] > 0).sort((a, b) => d.net[b] - d.net[a])
    if (methods.length && d.netTotal > 0) {
      const top = methods[0]
      out.push(`${METHOD_LABEL[top]} foi a forma mais usada: ${pct(d.net[top] / d.netTotal)} do que entrou.`)
    }
    if (d.byHour.length > 1) {
      const best = [...d.byHour].sort((a, b) => b.total - a.total)[0]
      out.push(`Melhor horário: das ${best.hour}h às ${best.hour + 1}h, com ${brl(best.total)}.`)
    }
    if (d.topByQuantity) out.push(`Mais saiu: ${d.topByQuantity.name} (${d.topByQuantity.quantity} un.).`)
    const topValue = d.topProducts[0]
    if (topValue && topValue.name !== d.topByQuantity?.name) {
      out.push(`Destaque em valor: ${topValue.name} (${brl(topValue.total)}).`)
    }
    if (d.last7Avg > 0) {
      const diff = d.revenue / d.last7Avg - 1
      if (Math.abs(diff) < 0.1) out.push(`Dia dentro da média dos últimos 7 dias (${brl(d.last7Avg)}).`)
      else if (diff > 0) out.push(`Dia ${pct(diff)} acima da média dos últimos 7 dias (${brl(d.last7Avg)}).`)
      else out.push(`Dia ${pct(-diff)} abaixo da média dos últimos 7 dias (${brl(d.last7Avg)}).`)
    }
  }
  if (d.feesTotal && d.feesTotal > 0.004) {
    const deposit = d.net.card + d.net.pix - d.feesTotal
    out.push(`Taxas de cartão e Pix: ${brl(d.feesTotal)}. Do cartão e Pix, caem na conta ${brl(deposit)}.`)
  }
  if (d.refunds.count > 0) {
    out.push(`${d.refunds.count} ${d.refunds.count === 1 ? "venda estornada" : "vendas estornadas"} (${brl(d.refunds.total)}).`)
  }
  return out
}
