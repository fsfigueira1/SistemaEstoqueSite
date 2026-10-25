// Resposta automática do WhatsApp: o robô do aplicativo (electron/whatsappAuto.cjs)
// pergunta aqui se pode responder uma conversa e com qual texto. A resposta é
// a mesma do copiloto (orçamento montado pelo sistema, IA só no texto de
// conversa); a regra de quando responder está em src/lib/autoReplyPolicy.ts.
import { getServerSettings } from "@/lib/serverSettings"
import { autoDecision, needsHuman, withinHours } from "@/lib/autoReplyPolicy"
import { CopilotService } from "@/services/copilotService"

type Ai = (system: string, user: string) => Promise<string>

export type AutoResult =
  | { action: "off" }
  | { action: "wait"; reason: string }
  | { action: "human"; reason: string }
  | { action: "send"; reply: string; intent: string; quoteRequestId: string | null }

export const AutoReplyService = {
  async status(now = new Date()) {
    const s = await getServerSettings()
    return { enabled: Boolean(s.waAutoEnabled), inHours: withinHours(now, s), maxPerHour: s.waAutoMaxPerHour ?? 20 }
  },

  async decide(input: { name: string; phone: string; text: string }, opts: { ai?: Ai; now?: Date } = {}): Promise<AutoResult> {
    const s = await getServerSettings()
    if (!s.waAutoEnabled) return { action: "off" }
    if (!withinHours(opts.now ?? new Date(), s)) return { action: "wait", reason: "fora do horário da resposta automática" }
    // assunto delicado nem passa pela IA (e não vira orçamento)
    if (needsHuman(input.text)) return { action: "human", reason: "assunto delicado (troca, defeito, reclamação ou cobrança)" }
    const draft = await CopilotService.draft({ ...input, replaceId: null }, { ai: opts.ai, now: opts.now })
    // IA sem chave / fora do ar: o texto reserva é bom para o atendente, não para enviar sozinho
    if (draft.fallback) return { action: "human", reason: "a IA não conseguiu responder agora (confira a chave da NVIDIA)" }
    if (draft.intent === "product" && !draft.productFound)
      return { action: "human", reason: `não achei "${draft.productQuery}" no estoque — confira se tem com outro nome` }
    const d = autoDecision(draft.intent, input.text)
    if (!d.send) return { action: "human", reason: d.reason }
    return { action: "send", reply: draft.reply, intent: draft.intent, quoteRequestId: draft.quoteRequestId }
  },
}
