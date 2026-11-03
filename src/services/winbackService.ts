// "Chamar de volta": clientes que compraram ou pediram orçamento e sumiram há
// mais de N dias (Configurações) recebem UMA mensagem escrita pelo Nemotron,
// única para cada um, lembrando do que levaram. Quem envia é o robô do
// aplicativo (electron/whatsappAuto.cjs), devagar: só no horário, poucas por
// dia, nunca para quem pediu SAIR e no máximo uma vez a cada 90 dias.
// Testado em tests/winbackService.test.ts.
import { prisma } from "@/lib/prisma"
import { whatsappNumber } from "@/lib/restock"
import { withinHours } from "@/lib/autoReplyPolicy"
import { PRICE_RE } from "@/lib/copilotStyle"
import { llmChat } from "@/lib/llm"
import { getServerSettings, type ServerSettings } from "@/lib/serverSettings"
import { CopilotParts } from "@/services/copilotService"
import { AgentEventService } from "@/services/agentEventService"

type Ai = (system: string, user: string) => Promise<string>

export type WinbackCandidate = {
  phone: string
  name: string
  lastAt: Date
  /** o que comprou/pediu por último ("caderno 10 matérias, lápis de cor") */
  what: string
  source: "compra" | "orcamento"
}

const DAY = 86_400_000
/** a mesma pessoa não recebe outro "chamar de volta" antes disso */
const COOLDOWN_DAYS = 90
const OPT_OUT_LINE = "Se não quiser mais receber avisos, é só responder SAIR."

/** Meia-noite de hoje em Brasília. */
export function startOfDayBrt(now: Date): Date {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  return new Date(`${d}T00:00:00-03:00`)
}

async function candidates(s: ServerSettings, now: Date, limit = 30): Promise<WinbackCandidate[]> {
  const cutoff = new Date(now.getTime() - (s.waWinbackDays ?? 60) * DAY)
  const byPhone = new Map<string, WinbackCandidate>()
  const keep = (c: WinbackCandidate) => {
    const cur = byPhone.get(c.phone)
    if (!cur || cur.lastAt < c.lastAt) byPhone.set(c.phone, c)
  }

  const customers = await prisma.customer.findMany({
    where: { phone: { not: null }, sales: { some: { status: "COMPLETED" } } },
    select: {
      name: true,
      phone: true,
      sales: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, items: { take: 3, select: { productName: true, product: { select: { name: true } } } } },
      },
    },
  })
  for (const c of customers) {
    const phone = whatsappNumber(c.phone)
    const sale = c.sales[0]
    if (!phone || !sale) continue
    const what = sale.items.map((i) => i.product?.name ?? i.productName ?? "").filter(Boolean).join(", ")
    keep({ phone, name: c.name, lastAt: sale.createdAt, what, source: "compra" })
  }

  const quotes = await prisma.quoteRequest.findMany({
    where: { phone: { not: null }, status: { not: "cancelado" } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: { name: true, phone: true, title: true, createdAt: true },
  })
  for (const q of quotes) {
    const phone = whatsappNumber(q.phone)
    if (phone) keep({ phone, name: q.name, lastAt: q.createdAt, what: q.title ? `orçamento de ${q.title}` : "orçamento", source: "orcamento" })
  }

  const phones = [...byPhone.keys()]
  if (!phones.length) return []
  const [out, recent] = await Promise.all([
    prisma.contact.findMany({ where: { phone: { in: phones }, optOutAt: { not: null } }, select: { phone: true } }),
    prisma.agentEvent.findMany({
      where: {
        phone: { in: phones },
        OR: [
          { kind: "winback", status: { not: "falhou" }, createdAt: { gte: new Date(now.getTime() - COOLDOWN_DAYS * DAY) } },
          { kind: "optout" },
          // conversou com a loja há pouco: não está "parado"
          { kind: { in: ["reply", "handoff"] }, createdAt: { gte: cutoff } },
        ],
      },
      select: { phone: true },
    }),
  ])
  const skip = new Set([...out.map((c) => c.phone), ...recent.map((e) => e.phone)])
  return [...byPhone.values()]
    .filter((c) => c.lastAt < cutoff && !skip.has(c.phone))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, limit)
}

const monthsAgo = (from: Date, now: Date) => Math.max(1, Math.round((now.getTime() - from.getTime()) / (30 * DAY)))

function defaultAi(s: ServerSettings): Ai {
  return (system, user) =>
    llmChat(s, {
      timeoutMs: 60_000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })
}

/** Mensagem única para o cliente (sem preço, sem promoção inventada) + linha do SAIR. */
async function writeMessage(s: ServerSettings, c: WinbackCandidate, now: Date, ai: Ai): Promise<string | null> {
  const first = CopilotParts.firstName(c.name)
  const system = `Você escreve mensagens de WhatsApp da papelaria ${s.companyName} para clientes que não aparecem faz tempo.
Escreva UMA mensagem curta (até 3 linhas), calorosa e pessoal, em português do Brasil, como alguém da loja.
- Chame pelo primeiro nome, se houver.
- Lembre de leve do que a pessoa levou ou pediu, sem soar como vigilância.
- Convide para passar na loja ou mandar a lista/pedido por aqui.
- NUNCA escreva preço, desconto ou promoção, e não invente novidades.
- No máximo 1 emoji. Não escreva nada sobre "responder SAIR" (o sistema coloca).
${CopilotParts.storeFacts(s)}`
  const user = `Cliente: ${first || "(sem nome)"}\nÚltima vez: há ${monthsAgo(c.lastAt, now)} meses\n${c.source === "compra" ? "Comprou" : "Pediu"}: ${c.what || "material de papelaria"}`
  let text = ""
  try {
    text = (await ai(system, user)).trim()
  } catch {
    return null
  }
  // sem texto, texto enorme ou com preço: melhor não mandar nada
  if (!text || text.length > 420 || PRICE_RE.test(text) || /\bsair\b/i.test(text)) return null
  return `${text}\n\n${OPT_OUT_LINE}`
}

export type WinbackNext = { eventId: string; name: string; phone: string; text: string }

export const WinbackService = {
  candidates: async (now = new Date()) => candidates(await getServerSettings(), now),

  /** Próxima mensagem a enviar agora — ou null (desligado, fora do horário, limite do dia, ninguém na lista). */
  async next(opts: { now?: Date; ai?: Ai } = {}): Promise<WinbackNext | null> {
    const s = await getServerSettings()
    const now = opts.now ?? new Date()
    if (!s.waWinbackEnabled || !withinHours(now, s)) return null
    const today = await prisma.agentEvent.count({
      where: { kind: "winback", status: { in: ["enviada", "pronta"] }, createdAt: { gte: startOfDayBrt(now) } },
    })
    if (today >= (s.waWinbackPerDay ?? 8)) return null
    const ai = opts.ai ?? defaultAi(s)
    // tenta até 3 clientes: se a IA não escrever algo seguro, pula para o próximo
    for (const c of (await candidates(s, now, 3))) {
      const text = await writeMessage(s, c, now, ai)
      if (!text) continue
      const ev = await AgentEventService.log({
        kind: "winback",
        name: c.name,
        phone: c.phone,
        reply: text,
        reason: `${c.source === "compra" ? "comprou" : "pediu"} ${c.what || "na loja"} há ${monthsAgo(c.lastAt, now)} meses`,
        steps: ["analisando clientes parados", `lendo o histórico de ${CopilotParts.firstName(c.name) || "cliente"}`, "mensagem única escrita"],
      })
      return { eventId: ev.id, name: c.name, phone: c.phone, text }
    }
    return null
  },

  /** Quadro "Chamando de volta": as últimas mensagens e o que deu (respondeu, comprou). */
  async board(now = new Date()) {
    const s = await getServerSettings()
    const since = new Date(now.getTime() - 30 * DAY)
    const events = await prisma.agentEvent.findMany({
      where: { kind: "winback", status: { in: ["enviada", "pronta", "falhou"] }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 24,
    })
    const phones = [...new Set(events.map((e) => e.phone))]
    const [answers, customers] = await Promise.all([
      phones.length
        ? prisma.agentEvent.findMany({
            where: { phone: { in: phones }, kind: { in: ["reply", "handoff", "optout"] }, createdAt: { gte: since } },
            select: { phone: true, kind: true, createdAt: true },
          })
        : [],
      phones.length
        ? prisma.customer.findMany({
            where: { phone: { not: null } },
            select: { phone: true, sales: { where: { status: "COMPLETED", createdAt: { gte: since } }, select: { createdAt: true, totalAmount: true } } },
          })
        : [],
    ])
    const salesByPhone = new Map<string, Array<{ createdAt: Date; total: number }>>()
    for (const c of customers) {
      const p = whatsappNumber(c.phone)
      if (!p || !phones.includes(p)) continue
      salesByPhone.set(p, [...(salesByPhone.get(p) ?? []), ...c.sales.map((x) => ({ createdAt: x.createdAt, total: Number(x.totalAmount) }))])
    }
    const cards = events.map((e) => {
      const after = (d: Date) => d > e.createdAt
      const bought = (salesByPhone.get(e.phone) ?? []).filter((x) => after(x.createdAt)).reduce((a, x) => a + x.total, 0)
      const ans = answers.filter((a) => a.phone === e.phone && after(a.createdAt))
      const outcome =
        e.status === "falhou" ? "falhou" : bought > 0 ? "comprou" : ans.some((a) => a.kind === "optout") ? "saiu" : ans.length ? "respondeu" : e.status === "enviada" ? "enviada" : "na fila"
      return { id: e.id, name: e.name, phone: e.phone, reason: e.reason, text: e.reply, at: e.createdAt, outcome, bought }
    })
    const sentToday = events.filter((e) => e.status === "enviada" && e.createdAt >= startOfDayBrt(now)).length
    return {
      enabled: Boolean(s.waWinbackEnabled),
      days: s.waWinbackDays ?? 60,
      perDay: s.waWinbackPerDay ?? 8,
      sentToday,
      waiting: (await candidates(s, now, 200)).length,
      cards,
    }
  },
}
