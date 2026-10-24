// Resposta automática do WhatsApp: quando a IA pode responder sozinha.
// Só no horário configurado (horário de Brasília), só orçamento e perguntas
// simples; assunto delicado (troca, defeito, reclamação, cobrança) sempre fica
// para o atendente. Testado em autoReplyPolicy.test.ts.
import { norm } from "@/lib/schoolList"

export type AutoHours = { waAutoWeekdays: string; waAutoSaturday: string; waAutoSunday: string }

/** "08:00-18:00" → [480, 1080] (minutos do dia); vazio ou inválido = fechado. */
export function parseRange(s: string): [number, number] | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(s || "")
  if (!m) return null
  const a = Number(m[1]) * 60 + Number(m[2])
  const b = Number(m[3]) * 60 + Number(m[4])
  return a < b && b <= 24 * 60 ? [a, b] : null
}

const BRT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

export function withinHours(now: Date, h: AutoHours): boolean {
  const parts = Object.fromEntries(BRT.formatToParts(now).map((p) => [p.type, p.value]))
  const range = parts.weekday === "Sun" ? h.waAutoSunday : parts.weekday === "Sat" ? h.waAutoSaturday : h.waAutoWeekdays
  const r = parseRange(range)
  if (!r) return false
  const min = Number(parts.hour) * 60 + Number(parts.minute)
  return min >= r[0] && min < r[1]
}

const SENSITIVE = /\b(troca\w*|trocar|devol\w*|defeit\w*|quebr\w*|estrag\w*|reclam\w*|procon|reembols\w*|estorn\w*|cobranc\w*|cobrad\w*|errad\w*|cancel\w*|problema\w*|golpe|fraude|advogad\w*|processo|atras\w*|demor\w*|insatisf\w*|pessim\w*|absurd\w*)\b/

/** Assunto que pede uma pessoa (troca, defeito, reclamação, cobrança…). */
export const needsHuman = (text: string) => SENSITIVE.test(norm(text))

const SIMPLE = [
  /\b(que horas|horario|abre|abrem|fecha|fecham|funciona|aberto|aberta|expediente)\b/,
  /\b(onde fica|endereco|localizacao|como chego|estacionamento|perto de)\b/,
  /\b(aceita|aceitam|pix|cartao|credito|debito|parcel\w*|dinheiro)\b/,
  /\b(entrega\w*|entregam|delivery|frete|retir\w*|imprim\w*|impressao|xerox|copia\w*|plastifica\w*|encaderna\w*)\b/,
  /\b(tem|tens|voces tem|vende|vendem|trabalham com|ainda tem|chegou)\b/,
  /\b(telefone|contato|instagram|site)\b/,
]
const GREETING_ONLY = /^(oi+|ola|bom dia|boa tarde|boa noite|tudo bem|e ai|obrigad[oa]|valeu|ok|blz|beleza|[\s!?.,]|\p{Extended_Pictographic})+$/u

/** Pergunta que a IA responde bem sozinha (horário, endereço, pagamento, "tem X?", cumprimento). */
export function isSimpleQuestion(text: string): boolean {
  const t = norm(text)
  if (GREETING_ONLY.test(t)) return true
  if (t.length > 280) return false
  // propaganda/aviso de empresa costuma ser longa e não pergunta nada
  if (/\b(vim te informar|novidade para voce|promocao exclusiva|clique no link)\b/.test(t)) return false
  return SIMPLE.some((re) => re.test(t))
}

export type AutoDecision = { send: true } | { send: false; reason: string }

/** Orçamento (lista, pedido do site, código) sempre; mensagem comum só se for pergunta simples. */
export function autoDecision(intent: "site" | "code" | "list" | "product" | "other", text: string): AutoDecision {
  if (needsHuman(text)) return { send: false, reason: "assunto delicado (troca, defeito, reclamação ou cobrança)" }
  if (intent !== "other") return { send: true }
  if (isSimpleQuestion(text)) return { send: true }
  return { send: false, reason: "não é orçamento nem pergunta simples" }
}
