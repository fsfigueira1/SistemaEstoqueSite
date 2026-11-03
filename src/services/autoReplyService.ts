// Resposta automática do WhatsApp: o robô do aplicativo (electron/whatsappAuto.cjs)
// pergunta aqui se pode responder uma conversa e com qual texto. Quem decide e
// escreve é o agente Nemotron (src/services/agentService.ts), com as ferramentas
// do sistema; assunto delicado nem chega na IA. Tudo fica registrado em
// AgentEvent (painel "IA hoje"). Testado em tests/autoReplyService.test.ts.
import { getServerSettings } from "@/lib/serverSettings"
import { autoDecision, needsHuman, withinHours } from "@/lib/autoReplyPolicy"
import { norm } from "@/lib/schoolList"
import { prisma } from "@/lib/prisma"
import { AgentService, type ChatLine, type Complete } from "@/services/agentService"
import { AgentEventService } from "@/services/agentEventService"

type Ai = (system: string, user: string) => Promise<string>

export type AutoResult =
  | { action: "off" }
  | { action: "wait"; reason: string }
  | { action: "human"; reason: string; eventId?: string }
  | { action: "send"; reply: string; intent: string; quoteRequestId: string | null; steps: string[]; mode: string; eventId: string }

/** "SAIR", "parar", "não quero mais receber": sai do "chamar de volta". */
export const isOptOut = (text: string) =>
  /^(sair|parar|pare|stop|descadastrar|remover|nao quero (mais )?(receber|mensagens?)|nao me mande mais( mensagens?)?)[\s.!]*$/.test(norm(text).trim())

const OPTOUT_REPLY = "Pronto! Não vou mais te mandar mensagens de aviso. Se precisar de algo, é só chamar por aqui 😊"
const OPTOUT_STEPS = ["cliente pediu para sair", "parei os avisos"]

async function optOut(name: string, phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return
  await prisma.contact.upsert({
    where: { phone: digits },
    update: { optOutAt: new Date() },
    create: { phone: digits, name: name || null, source: "whatsapp", optOutAt: new Date() },
  })
}

export const AutoReplyService = {
  async status(now = new Date()) {
    const s = await getServerSettings()
    return {
      enabled: Boolean(s.waAutoEnabled),
      inHours: withinHours(now, s),
      maxPerHour: s.waAutoMaxPerHour ?? 20,
      winbackEnabled: Boolean(s.waWinbackEnabled),
      winbackPerDay: s.waWinbackPerDay ?? 8,
    }
  },

  async decide(
    input: { name: string; phone: string; text: string; history?: ChatLine[] },
    opts: { ai?: Ai; complete?: Complete; now?: Date } = {},
  ): Promise<AutoResult> {
    const s = await getServerSettings()
    if (!s.waAutoEnabled) return { action: "off" }
    if (!withinHours(opts.now ?? new Date(), s)) return { action: "wait", reason: "fora do horário da resposta automática" }
    const base = { name: input.name, phone: input.phone, customerText: input.text }

    if (isOptOut(input.text)) {
      await optOut(input.name, input.phone)
      const ev = await AgentEventService.log({ ...base, kind: "optout", reply: OPTOUT_REPLY, steps: OPTOUT_STEPS })
      return { action: "send", reply: OPTOUT_REPLY, intent: "other", quoteRequestId: null, steps: OPTOUT_STEPS, mode: "agente", eventId: ev.id }
    }

    const human = async (reason: string, steps: string[] = []) => {
      const ev = await AgentEventService.log({ ...base, kind: "handoff", reason, steps })
      return { action: "human" as const, reason, eventId: ev.id }
    }
    // assunto delicado nem passa pela IA (e não vira orçamento)
    if (needsHuman(input.text)) return human("assunto delicado (troca, defeito, reclamação ou cobrança)", ["assunto delicado", "chamando o atendente"])

    const r = await AgentService.run(input, { ai: opts.ai, complete: opts.complete, now: opts.now })
    if (r.action === "human") return human(r.reason, r.steps)
    // modo simples (NVIDIA sem ferramentas/fora do ar): mantém a regra antiga
    if (r.mode === "simples") {
      if (r.fallback) return human("a IA não conseguiu responder agora (confira a chave da NVIDIA)", r.steps)
      if (r.intent === "product" && !r.productFound) return human(`não achei "${r.productQuery}" no estoque — confira se tem com outro nome`, r.steps)
      const d = autoDecision(r.intent, input.text)
      if (!d.send) return human(d.reason, r.steps)
    }
    const ev = await AgentEventService.log({
      ...base,
      kind: "reply",
      intent: r.intent,
      steps: r.steps,
      reply: r.reply,
      quoteRequestId: r.quoteRequestId,
      total: r.total,
    })
    return { action: "send", reply: r.reply, intent: r.intent, quoteRequestId: r.quoteRequestId, steps: r.steps, mode: r.mode, eventId: ev.id }
  },
}
