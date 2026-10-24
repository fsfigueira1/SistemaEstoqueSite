// Copiloto do atendimento: recebe a mensagem que o cliente mandou no WhatsApp
// (colada pelo atendente) e devolve a resposta pronta. Quando é pedido de
// orçamento, o orçamento é montado AQUI, com o preço e o estoque de agora, e
// salvo em Orçamentos pedidos — a IA só escreve a abertura (preço nunca passa
// pela IA). Nas outras mensagens a IA responde como atendente, só com os dados
// da loja. Quem envia é sempre o atendente. Testado em tests/copilotService.test.ts.
import { allocate, buildQuote, quoteMessage, quoteTotals, type CatalogProduct } from "@/lib/schoolList"
import { classify, EXPLICIT_QTY, stripGreetings, type SiteOrder } from "@/lib/quoteIntent"
import { NVIDIA_DEFAULT_MODEL, nvidiaChat } from "@/lib/nvidia"
import { getServerSettings, type ServerSettings } from "@/lib/serverSettings"
import { prisma } from "@/lib/prisma"
import { CATALOG_SELECT, getCatalog, toCatalogProduct } from "@/services/schoolListService"
import { SavedListService } from "@/services/savedListService"
import { QuoteRequestService, type QuoteItem } from "@/services/quoteRequestService"
import { CopilotExampleService } from "@/services/copilotExampleService"
import { PRICE_RE, buildPersonaPrompt } from "@/lib/copilotStyle"
import { productQuery } from "@/lib/productQuestion"
import { productSearchFields, smartSearch } from "@/lib/smartSearch"

/** Decisão da dona: uniforme do pedido do site fica para a loja confirmar. */
const QUOTE_SITE_UNIFORMS = false

type Ai = (system: string, user: string) => Promise<string>
type Line = { qty: number; text: string; product: CatalogProduct | null }
type Built = { title: string; lines: Line[]; toConfirm: string[] }

export type DraftResult = {
  reply: string
  intent: "site" | "code" | "list" | "product" | "other"
  quoteRequestId: string | null
  total: number | null
  /** a IA não respondeu e saiu o texto reserva (o automático não envia isso) */
  fallback?: boolean
  /** pergunta "tem X?": achou o produto no estoque (o automático só responde se achou) */
  productFound?: boolean
  /** o que o cliente procurou ("stabilo pastel azul") */
  productQuery?: string
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const brl = (v: number) => money.format(v || 0)
const firstName = (name: string) => {
  const w = name.trim().split(/\s+/)[0] ?? ""
  return w ? w[0].toLocaleUpperCase("pt-BR") + w.slice(1).toLocaleLowerCase("pt-BR") : ""
}

async function siteQuote(order: SiteOrder): Promise<Built> {
  const toConfirm: string[] = []
  const bySku = new Map<string, { qty: number; text: string }>()
  for (const i of order.grupos.flatMap((g) => g.itens)) {
    if (!i.sku || (i.secao === "uniforme" && !QUOTE_SITE_UNIFORMS)) {
      toConfirm.push(`${i.qtd} × ${i.descricao}`)
      continue
    }
    const cur = bySku.get(i.sku)
    if (cur) cur.qty += i.qtd
    else bySku.set(i.sku, { qty: i.qtd, text: i.descricao })
  }
  const rows = bySku.size
    ? await prisma.product.findMany({ where: { sku: { in: [...bySku.keys()] }, status: "ACTIVE" }, select: CATALOG_SELECT })
    : []
  const bySkuProduct = new Map(rows.map((r) => [r.sku, toCatalogProduct(r)]))
  const lines: Line[] = []
  for (const [sku, l] of bySku) {
    const product = bySkuProduct.get(sku)
    // SKU que não existe/inativo: a loja confere (não é "não temos")
    if (product) lines.push({ qty: l.qty, text: l.text, product })
    else toConfirm.push(`${l.qty} × ${l.text}`)
  }
  return { title: "pedido do site", lines, toConfirm }
}

/** Lista digitada. null = não parece lista (nenhum item casou e menos de 2 linhas com quantidade). */
async function listQuote(text: string): Promise<Built | null> {
  const catalog = await getCatalog()
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const quote = buildQuote(stripGreetings(text), catalog)
  const matched = quote.filter((l) => l.productId && byId.has(l.productId)).length
  const withQty = quote.filter((l) => EXPLICIT_QTY.test(l.raw)).length
  if (!matched && withQty < 2) return null
  const lines: Line[] = []
  const toConfirm: string[] = []
  for (const l of quote) {
    const product = l.productId ? byId.get(l.productId) : undefined
    // aceita como lista: o que não casou vai para a loja conferir (nada some)
    if (product) lines.push({ qty: l.qty, text: l.text, product })
    else toConfirm.push(`${l.qty} × ${l.text}`)
  }
  return { title: "sua lista", lines, toConfirm }
}

async function savedQuote(code: string): Promise<Built | null> {
  const q = await SavedListService.getQuote(code, { activeOnly: true })
  if (!q) return null
  return { title: `${q.list.schoolName} — ${q.list.grade}`, lines: q.lines, toConfirm: [] }
}

function quoteText(store: string, address: string, b: Built): string {
  const parts = [quoteMessage(store, b.title, b.lines, brl)]
  if (b.toConfirm.length) parts.push(["A loja confirma e te responde por aqui:", ...b.toConfirm.map((t) => `• ${t}`)].join("\n"))
  parts.push([address ? `Retirada na loja: ${address}.` : "Retirada na loja.", "Valores e disponibilidade conferidos agora, sujeitos a alteração na retirada."].join("\n"))
  return parts.join("\n\n")
}

const storeFacts = (s: ServerSettings) =>
  [
    `Loja: ${s.companyName}`,
    s.companyAddress ? `Endereço: ${s.companyAddress}` : "",
    s.companyPhone ? `Telefone: ${s.companyPhone}` : "",
    s.storeHours ? `Horário: ${s.storeHours}` : "",
    s.storeInfo ? `Informações da loja:\n${s.storeInfo}` : "",
  ]
    .filter(Boolean)
    .join("\n")

const nowFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
/** Dia e hora de agora em Brasília (a IA não sabe que dia é hoje). */
const nowNote = (d: Date) => `Agora: ${nowFormat.format(d)} (horário de Brasília).`

function defaultAi(settings: ServerSettings): Ai {
  return async (system, user) => {
    const apiKey = settings.nvidiaApiKey.trim()
    if (!apiKey) throw new Error("sem chave da NVIDIA")
    return nvidiaChat({
      apiKey,
      model: settings.nvidiaModel || NVIDIA_DEFAULT_MODEL,
      timeoutMs: 60_000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })
  }
}

const NOT_FOUND = "Não encontrei essa lista aqui. Pode mandar a lista de material (texto ou foto) que eu monto o orçamento com o que temos na loja."

const MAX_PRODUCT_LINES = 6

/** Resposta para "tem X?" com o que tem no estoque agora. */
async function productReply(asked: string, first: string, persona: string, settings: ServerSettings, ai: Ai): Promise<DraftResult> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, sku: true, barcode: true, salePrice: true, stockQuantity: true, category: { select: { name: true } } },
  })
  // com todas as palavras; se nada, sem o tipo do produto ("caderno do batman"
  // acha "FORONI BATMAN 80 FOLHAS", que não tem "caderno" no nome)
  const strict = smartSearch(rows, asked, productSearchFields, { strict: true })
  const exact = strict.length ? strict : smartSearch(rows, asked, productSearchFields)
  const have = exact.filter((p) => p.stockQuantity > 0)
  const hi = first ? `Oi, ${first}!` : "Oi!"
  const base = { intent: "product" as const, quoteRequestId: null, total: null, productQuery: asked }
  const list = (ps: typeof rows) => [
    ...ps.slice(0, MAX_PRODUCT_LINES).map((p) => `• ${p.name} — ${brl(Number(p.salePrice))}`),
    ...(ps.length > MAX_PRODUCT_LINES ? [`• e mais ${ps.length - MAX_PRODUCT_LINES} opções na loja`] : []),
  ]

  if (have.length) {
    let opening = ""
    try {
      opening = (
        await ai(
          `${persona}\n\nVocê atende a papelaria ${settings.companyName} no WhatsApp. O cliente perguntou se temos um produto e TEMOS — a lista com nomes e preços já está pronta logo abaixo. Escreva SÓ uma abertura curta (1 linha) dizendo que temos. Não escreva nomes de produto, preços nem quantidades.`,
          `Cliente${first ? ` (${first})` : ""} perguntou: ${asked}`,
        )
      ).trim()
    } catch {
      opening = ""
    }
    if (!opening || opening.length > 200 || PRICE_RE.test(opening)) opening = `${hi} Temos sim 😊`
    const reply = [opening, "", ...list(have), "", "Preço de agora, sujeito à disponibilidade na retirada."].join("\n")
    return { ...base, reply, productFound: true }
  }
  if (exact.length) {
    const reply = [`${hi} No momento está em falta:`, ...list(exact), "", "Se quiser, vejo uma opção parecida pra você 😊"].join("\n")
    return { ...base, reply, productFound: true }
  }
  // não achou: o atendente confere (pode ser só outro nome no cadastro) — nunca "não temos"
  return { ...base, reply: `${hi} Vou conferir se temos e já te respondo por aqui 😊`, productFound: false }
}

export const CopilotService = {
  async draft(
    input: { name: string; phone: string; text: string; /** gerar de novo: substitui este orçamento */ replaceId?: string | null },
    deps: { ai?: Ai; now?: Date } = {},
  ): Promise<DraftResult> {
    const settings = await getServerSettings()
    // personalidade (Configurações) + respostas aprovadas recentes = o jeito da loja
    const persona = buildPersonaPrompt(settings.copilotPersona, await CopilotExampleService.list(6))
    const ai = deps.ai ?? defaultAi(settings)
    const name = String(input.name ?? "").trim().slice(0, 120)
    const text = String(input.text ?? "").trim().slice(0, 8000)
    const first = firstName(name)
    const intent = classify(text)

    let built: Built | null = null
    if (intent.kind === "site") built = await siteQuote(intent.order)
    else if (intent.kind === "code") {
      built = await savedQuote(intent.code)
      if (!built) return { reply: NOT_FOUND, intent: "code", quoteRequestId: null, total: null }
    } else if (intent.kind === "list") built = (intent.code && (await savedQuote(intent.code))) || (await listQuote(text))

    // nada reconhecido no pedido/lista: responde como mensagem comum (nada de "vou conferir" vazio)
    if (built && !built.lines.length && !built.toConfirm.length) built = null

    // "Vocês têm X?": busca no estoque; o sistema escreve a lista e o preço, a IA só a abertura
    const asked = !built ? productQuery(text) : null
    if (asked) return productReply(asked, first, persona, settings, ai)

    if (!built) {
      const system = `${persona}

Você atende a papelaria ${settings.companyName} no WhatsApp. Responda a mensagem do cliente em português do Brasil, curto (até 4 linhas), como uma pessoa da loja.
Regras: responda exatamente o que o cliente perguntou, usando só os dados da loja abaixo; nunca invente preço, estoque ou prazo; se o cliente quiser orçamento, peça para mandar a lista de material (texto ou foto); se a resposta não estiver nos dados, diga que vai verificar e já responde.
${storeFacts(settings)}
${nowNote(deps.now ?? new Date())} Use isso para "hoje", "amanhã" e "está aberto agora"; se o dia estiver fora do horário, diga que a loja está fechada nesse dia.`
      let reply = ""
      try {
        reply = (await ai(system, `Cliente${first ? ` (${first})` : ""}: ${text}`)).trim()
      } catch {
        reply = ""
      }
      const fallback = !reply || reply.length > 700 || PRICE_RE.test(reply)
      if (fallback) {
        reply = [
          `Oi${first ? `, ${first}` : ""}! Recebemos sua mensagem e já te respondemos por aqui.`,
          "Se for orçamento de material, pode mandar a lista (texto ou foto).",
          settings.storeHours ? `Horário: ${settings.storeHours}.` : "",
          settings.companyAddress ? `Endereço: ${settings.companyAddress}.` : "",
        ]
          .filter(Boolean)
          .join("\n")
      }
      return { reply, intent: "other", quoteRequestId: null, total: null, fallback }
    }

    // nada com preço (só uniforme, só itens a conferir…): não é orçamento de R$ 0,00
    if (!built.lines.some((l) => l.product)) {
      const pending = [...built.lines.map((l) => `${l.qty} × ${l.text}`), ...built.toConfirm]
      const reply = [`${first ? `Oi, ${first}!` : "Olá!"} Vou conferir esses itens e já te respondo por aqui:`, ...pending.map((t) => `• ${t}`)].join("\n")
      return { reply, intent: intent.kind, quoteRequestId: null, total: null }
    }

    const quote = quoteText(settings.companyName, settings.companyAddress, built)
    let opening = ""
    try {
      opening = (
        await ai(
          `${persona}

Você atende a papelaria ${settings.companyName} no WhatsApp. Escreva SÓ uma abertura curta (no máximo 2 linhas) para vir antes de um orçamento que já está pronto logo abaixo. Cumprimente pelo primeiro nome se houver. Não escreva preços, itens nem totais.`,
          `Cliente${first ? ` (${first})` : ""} escreveu: ${text.slice(0, 600)}`,
        )
      ).trim()
    } catch {
      opening = ""
    }
    // abertura longa demais ou com números de preço é descartada
    if (!opening || opening.length > 280 || PRICE_RE.test(opening)) opening = `${first ? `Oi, ${first}!` : "Olá!"} Segue o orçamento:`
    const reply = `${opening}\n\n${quote}`

    const takes = allocate(built.lines)
    const items: QuoteItem[] = built.lines
      .map((l, i) => ({ qty: l.qty, text: l.text, productId: l.product?.id ?? null, price: l.product?.salePrice ?? null, take: takes[i] ?? 0 }))
      .filter((i) => i.productId)
    const missing = built.lines.filter((l) => !l.product).map((l) => `${l.qty} × ${l.text}`)
    const total = quoteTotals(built.lines).total
    const data = {
      name,
      phone: input.phone,
      source: "whatsapp" as const,
      title: built.title,
      items,
      toConfirm: [...missing, ...built.toConfirm],
      total,
      message: reply,
    }
    const id = (input.replaceId && (await QuoteRequestService.replace(input.replaceId, data))) || (await QuoteRequestService.create(data)).id
    return { reply, intent: intent.kind, quoteRequestId: id, total }
  },
}
