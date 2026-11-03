// Painel "IA hoje" do Atendimento: o que o agente fez hoje, os orçamentos
// montados e as vendas do caixa (dia de Brasília).
import { prisma } from "@/lib/prisma"
import { startOfDayBrt } from "@/services/winbackService"

export const AgentDashboardService = {
  async today(now = new Date()) {
    const from = startOfDayBrt(now)
    const [byKind, quotes, sales, recent] = await Promise.all([
      prisma.agentEvent.groupBy({ by: ["kind", "status"], where: { createdAt: { gte: from } }, _count: { _all: true } }),
      prisma.quoteRequest.aggregate({ where: { createdAt: { gte: from }, status: { not: "cancelado" } }, _count: { _all: true }, _sum: { total: true } }),
      prisma.sale.aggregate({ where: { createdAt: { gte: from }, status: "COMPLETED" }, _count: { _all: true }, _sum: { totalAmount: true } }),
      prisma.agentEvent.findMany({ where: { kind: { in: ["reply", "handoff", "optout"] } }, orderBy: { createdAt: "desc" }, take: 8 }),
    ])
    const count = (kind: string, status?: string) =>
      byKind.filter((r) => r.kind === kind && (!status || r.status === status)).reduce((a, r) => a + r._count._all, 0)
    return {
      ai: {
        // respostas que saíram de verdade (o robô confirmou o envio)
        replies: count("reply", "enviada") + count("optout", "enviada"),
        handoffs: count("handoff"),
        winbacks: count("winback", "enviada"),
      },
      quotes: { count: quotes._count._all, total: Number(quotes._sum.total ?? 0) },
      sales: { count: sales._count._all, total: Number(sales._sum.totalAmount ?? 0) },
      recent: recent.map((e) => ({
        id: e.id,
        kind: e.kind,
        name: e.name,
        intent: e.intent,
        steps: Array.isArray(e.steps) ? (e.steps as string[]) : [],
        customerText: e.customerText,
        reply: e.reply,
        reason: e.reason,
        total: Number(e.total),
        status: e.status,
        at: e.createdAt,
        sentAt: e.sentAt,
      })),
    }
  },
}
