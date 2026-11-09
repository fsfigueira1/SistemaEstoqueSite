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
import { NOT_A_LIST, readListWithAI, receiptInfo } from "@/services/schoolListService"
import { CirandaPaymentService, cirandaReply, isCirandaReceipt } from "@/services/cirandaPaymentService"

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
    input: { name: string; phone: string; text: string; images?: string[]; history?: ChatLine[] },
    opts: { ai?: Ai; complete?: Complete; now?: Date; readPhoto?: (dataUrl: string) => Promise<string> } = {},
  ): Promise<AutoResult> {
    const s = await getServerSettings()
    if (!s.waAutoEnabled) return { action: "off" }
    if (!withinHours(opts.now ?? new Date(), s)) return { action: "wait", reason: "fora do horário da resposta automática" }
    const photos = input.images ?? []
    const photoTag = photos.length ? `[${photos.length} foto${photos.length > 1 ? "s" : ""}]` : ""
    const base = { name: input.name, phone: input.phone, customerText: [photoTag, input.text].filter(Boolean).join(" ") }

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

    // foto: a IA de visão transcreve a lista e o agente trata como lista digitada
    let agentInput: { name: string; phone: string; text: string; history?: ChatLine[] } = input
    if (photos.length) {
      const read = opts.readPhoto ?? ((url: string) => readListWithAI(url, { rejectOther: true }))
      let texts: string[]
      try {
        texts = await Promise.all(photos.map(read))
      } catch {
        return human("não consegui ler a foto — veja a conversa", ["lendo a foto", "chamando o atendente"])
      }
      const receipts = photos.flatMap((image, i) => {
        const info = receiptInfo(texts[i])
        return info === null ? [] : [{ image, info }]
      })
      const lines = texts.map((t) => t.trim()).filter((t) => t && !t.includes(NOT_A_LIST) && receiptInfo(t) === null).join("\n")
      if (receipts.length) {
        // comprovante de outra compra não é da APM: uma pessoa confere
        if (!receipts.every((r) => isCirandaReceipt(r.info))) return human("mandou comprovante de pagamento — confira a conversa", ["lendo a foto", "chamando o atendente"])
        let saved = await CirandaPaymentService.addReceipt(input, receipts[0].image, receipts[0].info)
        for (const r of receipts.slice(1)) saved = await CirandaPaymentService.addReceipt(input, r.image, r.info)
        base.customerText = [base.customerText, "(comprovante do Ciranda)"].join(" ")
        if (!input.text.trim()) {
          const steps = ["lendo a foto", "comprovante salvo"]
          const reply = cirandaReply(saved)
          const ev = await AgentEventService.log({ ...base, kind: "reply", steps, reply })
          return { action: "send", reply, intent: "other", quoteRequestId: null, steps, mode: "agente", eventId: ev.id }
        }
        // comprovante com legenda: a legenda pode trazer os dados da criança
        const note = `[Comprovante do Pix do Ciranda recebido e salvo pelo sistema]\n${input.text}`
        agentInput = { ...input, text: note, history: input.history ? [...input.history, { from: "cliente", text: note }] : undefined }
        const r = await AgentService.run(agentInput, { ai: opts.ai, complete: opts.complete, now: opts.now })
        const reply = r.action === "send" ? r.reply : cirandaReply(saved)
        const ev = await AgentEventService.log({ ...base, kind: "reply", steps: r.steps, reply })
        return { action: "send", reply, intent: "other", quoteRequestId: null, steps: r.steps, mode: r.mode, eventId: ev.id }
      }
      if (!lines) return human("mandou foto que não é lista de material — veja a conversa", ["lendo a foto", "chamando o atendente"])
      const fromPhoto = `Lista de material enviada em foto:\n${lines}`
      agentInput = {
        ...input,
        text: [input.text, fromPhoto].filter(Boolean).join("\n"),
        history: input.history ? [...input.history, { from: "cliente", text: fromPhoto }] : undefined,
      }
      base.customerText = [base.customerText, lines].join("\n")
    }

    const r = await AgentService.run(agentInput, { ai: opts.ai, complete: opts.complete, now: opts.now })
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
