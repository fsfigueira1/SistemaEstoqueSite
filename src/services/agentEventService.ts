// Registro do que o agente de IA do WhatsApp fez (tabela AgentEvent): cada
// resposta, cada conversa passada para o atendente e cada "chamar de volta".
// Alimenta o painel "IA hoje" e o histórico do Atendimento.
// Testado em tests/agentService.test.ts.
import { prisma } from "@/lib/prisma"

export type AgentEventKind = "reply" | "handoff" | "winback" | "optout"
export type AgentEventStatus = "pronta" | "enviada" | "falhou" | "cancelada"

export type NewAgentEvent = {
  kind: AgentEventKind
  name: string
  phone?: string
  intent?: string
  steps?: string[]
  customerText?: string
  reply?: string
  reason?: string
  quoteRequestId?: string | null
  total?: number | null
  status?: AgentEventStatus
}

const digits = (p: string | undefined) => String(p ?? "").replace(/\D/g, "").slice(0, 15)

export const AgentEventService = {
  async log(e: NewAgentEvent) {
    return prisma.agentEvent.create({
      data: {
        kind: e.kind,
        name: e.name.slice(0, 120),
        phone: digits(e.phone),
        intent: e.intent ?? "other",
        steps: (e.steps ?? []).slice(0, 12).map((x) => x.slice(0, 120)),
        customerText: (e.customerText ?? "").slice(0, 4000),
        reply: (e.reply ?? "").slice(0, 8000),
        reason: (e.reason ?? "").slice(0, 300),
        quoteRequestId: e.quoteRequestId ?? null,
        total: e.total ?? 0,
        status: e.status ?? "pronta",
        sentAt: e.status === "enviada" ? new Date() : null,
      },
    })
  },

  /** O robô confirma se a mensagem saiu mesmo (ou não). */
  async mark(id: string, status: AgentEventStatus) {
    const r = await prisma.agentEvent.updateMany({
      where: { id, status: "pronta" },
      data: { status, sentAt: status === "enviada" ? new Date() : null },
    })
    return r.count > 0
  },

  recent(limit = 12) {
    return prisma.agentEvent.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(50, Math.max(1, limit)) })
  },
}
