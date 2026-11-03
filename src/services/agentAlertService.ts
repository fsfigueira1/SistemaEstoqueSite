// Avisos da assistente (quadro no canto da tela, para dono e balcão):
//  - "precisa de você": a IA passou a conversa para a loja (assunto delicado,
//    foto/áudio, produto que não achou…) e ninguém marcou como visto;
//  - "parou de responder": a IA respondeu (ex.: mandou o orçamento) e o
//    cliente sumiu há mais de 2 h (até 3 dias) — vale chamar de novo.
// Quem marcar "visto" tira para todo mundo (AgentEvent.seenAt). Sob pedido,
// o Nemotron sugere a mensagem para retomar. Testado em tests/agentAlertService.test.ts.
import { prisma } from "@/lib/prisma"
import { PRICE_RE } from "@/lib/copilotStyle"
import { llmChat } from "@/lib/llm"
import { getServerSettings } from "@/lib/serverSettings"
import { CopilotParts } from "@/services/copilotService"

const HOUR = 3_600_000
export const STALL_AFTER_MS = 2 * HOUR
const STALL_UNTIL_MS = 72 * HOUR
const HANDOFF_WINDOW_MS = 24 * HOUR

export type AgentAlert = {
  id: string
  type: "atendente" | "parou"
  name: string
  phone: string
  reason: string
  /** o que o cliente mandou / o que a IA respondeu (resumo) */
  customerText: string
  reply: string
  at: Date
}

type Ai = (system: string, user: string) => Promise<string>

/** Quem é o cliente: telefone se tiver; senão o nome (contato salvo só com nome). */
const who = (e: { phone: string; name: string }) => (e.phone ? `p:${e.phone}` : `n:${e.name.trim().toLowerCase()}`)

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

export const AgentAlertService = {
  async list(now = new Date()): Promise<AgentAlert[]> {
    const since = new Date(now.getTime() - STALL_UNTIL_MS)
    const events = await prisma.agentEvent.findMany({
      where: { createdAt: { gte: since }, kind: { in: ["reply", "handoff", "optout"] } },
      orderBy: { createdAt: "desc" },
    })
    // o último acontecimento de cada cliente decide o aviso
    const latest = new Map<string, (typeof events)[number]>()
    for (const e of events) if (!latest.has(who(e))) latest.set(who(e), e)

    const alerts: AgentAlert[] = []
    for (const e of latest.values()) {
      if (e.seenAt) continue
      const base = { id: e.id, name: e.name || "Cliente", phone: e.phone, customerText: clip(e.customerText, 280), reply: clip(e.reply, 400), at: e.createdAt }
      if (e.kind === "handoff" && now.getTime() - e.createdAt.getTime() <= HANDOFF_WINDOW_MS) {
        alerts.push({ ...base, type: "atendente", reason: e.reason || "a IA pediu ajuda" })
      } else if (e.kind === "reply" && e.status === "enviada") {
        const quiet = now.getTime() - (e.sentAt ?? e.createdAt).getTime()
        if (quiet >= STALL_AFTER_MS && quiet <= STALL_UNTIL_MS) {
          const what = e.quoteRequestId ? "depois do orçamento" : e.intent === "product" ? "depois de saber se temos o produto" : "depois da resposta"
          alerts.push({ ...base, type: "parou", reason: `parou de responder ${what}` })
        }
      }
    }
    // primeiro quem precisa de atendente; depois os mais recentes
    return alerts.sort((a, b) => (a.type === b.type ? b.at.getTime() - a.at.getTime() : a.type === "atendente" ? -1 : 1))
  },

  async markSeen(id: string) {
    const r = await prisma.agentEvent.updateMany({ where: { id, seenAt: null }, data: { seenAt: new Date() } })
    return r.count > 0
  },

  /** Robô do aplicativo: o que ele passou para a loja sem chegar na IA (foto, áudio, grupo, limite…). */
  async logHandoff(input: { name: string; phone?: string; reason: string }) {
    const e = await prisma.agentEvent.create({
      data: {
        kind: "handoff",
        name: input.name.slice(0, 120),
        phone: String(input.phone ?? "").replace(/\D/g, "").slice(0, 15),
        reason: input.reason.slice(0, 300),
        steps: ["vi a conversa", "chamando o atendente"],
      },
    })
    return e.id
  },

  /** Nemotron sugere a mensagem para retomar (sem preço; a pessoa confere e envia). */
  async suggest(id: string, deps: { ai?: Ai } = {}): Promise<string> {
    const e = await prisma.agentEvent.findUnique({ where: { id } })
    if (!e) throw new Error("Aviso não encontrado")
    const s = await getServerSettings()
    const ai: Ai =
      deps.ai ??
      ((system, user) => llmChat(s, { timeoutMs: 60_000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }))
    const first = CopilotParts.firstName(e.name)
    const system = `Você é a atendente da papelaria ${s.companyName} no WhatsApp. Escreva UMA mensagem curta (até 3 linhas), simpática e sem pressão, para retomar a conversa com o cliente que parou de responder. Chame pelo primeiro nome se houver. NUNCA escreva preço, desconto ou prazo. No máximo 1 emoji.`
    const user = `Cliente: ${first || "(sem nome)"}\nO cliente tinha escrito: ${clip(e.customerText, 600)}\nA loja respondeu: ${clip(e.reply, 600)}`
    const text = (await ai(system, user)).trim()
    if (!text || text.length > 500 || PRICE_RE.test(text)) throw new Error("A IA não conseguiu sugerir uma mensagem agora")
    return text
  },
}
