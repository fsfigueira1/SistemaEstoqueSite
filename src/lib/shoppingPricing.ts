// Pesquisa de preço gratuita pelo Google Shopping (via SerpApi) — só a parte
// "pura": ler a resposta e transformar em sugestão de preço. Sem rede/banco.
//
// A SerpApi devolve as ofertas do Google Shopping no Brasil (loja + preço).
// Limpamos o que distorce a média (usados, kits/caixas, preços fora da curva)
// e aplicamos a regra da loja:
//   referência = mediana dos preços das lojas
//   sugestão   = referência + "toque da loja" (%), arredondada para cima
//                (",50/,90" abaixo de R$ 10; ",90" acima)
//   nunca abaixo de custo + 30%
//   sem preço nenhum mas com custo → custo × 2 (margem típica de papelaria)
import { shelfPriceAtLeast, type PriceAdvice, type PriceSource } from "@/lib/priceAdvice"

export type AdviceCore = Omit<PriceAdvice, "checkedAt" | "cached" | "id">

/** Item de `shopping_results` da SerpApi (só os campos que usamos). */
export type SerpShoppingItem = {
  title?: string | null
  source?: string | null
  price?: string | null
  extracted_price?: number | null
  product_link?: string | null
  link?: string | null
  second_hand_condition?: string | null
  extensions?: string[] | null
}

export type Offer = { title: string; store: string; price: number; url: string | null; physical: boolean }

type Ctx = {
  costPrice?: number | null
  currentPrice?: number | null
  /** "Toque da loja" em % sobre a referência de mercado. */
  markupPct: number
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const round2 = (n: number) => Math.round(n * 100) / 100

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return round2(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}

function money(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? round2(v) : null
  if (typeof v !== "string") return null
  const s = v.replace(/[^\d,.]/g, "")
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s)
  return Number.isFinite(n) && n > 0 ? round2(n) : null
}

const SMALL = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "em", "a", "o", "p/", "c/"])

/**
 * Nomes que chegam em MAIÚSCULAS ("CADERNO TILIBRA 10 MATERIAS") viram
 * "Caderno Tilibra 10 Materias". Medidas com número ficam em minúsculas;
 * nomes já em caixa mista ficam como estão.
 */
export function prettyName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ")
  if (s !== s.toUpperCase()) return s
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (/\d/.test(w)) return w
      if (i > 0 && SMALL.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(" ")
}

// Embalagens múltiplas distorcem o preço unitário.
// "1 un" é unidade avulsa (fica); "12 un", "c/ 10", "kit", "caixa com" saem.
const MULTIPACK =
  /\bkit\b|\bcombo\b|\bcx\b|\bcaixa com\b|\bc\/\s?([2-9]|\d{2,})\b|\b([2-9]|\d{2,})\s?(un|und|unid|unidades)\b|\bpacote\b|\bpct\b|\batacado\b/i
const PHYSICAL = /nearby|perto|na loja|retirada|retire|in store|pick ?up/i

/** Converte a resposta da SerpApi em ofertas limpas. */
export function offersFromSerp(items: SerpShoppingItem[], query: string): Offer[] {
  const queryIsPack = MULTIPACK.test(query)
  const raw: Offer[] = []
  for (const it of items) {
    const price = money(it.extracted_price) ?? money(it.price)
    const title = (it.title ?? "").trim()
    if (!price || !title) continue
    if (it.second_hand_condition) continue // usado / recondicionado
    if (!queryIsPack && MULTIPACK.test(title)) continue
    raw.push({
      title,
      store: (it.source ?? "Loja").trim().slice(0, 60),
      price,
      url: it.product_link || it.link || null,
      physical: (it.extensions ?? []).some((e) => PHYSICAL.test(e)),
    })
  }
  if (raw.length < 3) return raw.slice(0, 10)
  // fora da curva: muito abaixo (acessório/peça) ou muito acima (outro modelo)
  const m = median(raw.map((o) => o.price))
  return raw.filter((o) => o.price >= m * 0.4 && o.price <= m * 2.5).slice(0, 10)
}

function suggest(reference: number | null, marketMax: number | null, ctx: Ctx) {
  const cost = ctx.costPrice && ctx.costPrice > 0 ? ctx.costPrice : null
  const floor = cost ? cost * 1.3 : 0
  const markup = Math.max(0, ctx.markupPct) / 100
  const notes: string[] = []

  if (!reference) {
    if (!cost) return { suggested: null, range: { min: null, max: null }, notes }
    const s = shelfPriceAtLeast(cost * 2)
    notes.push(`Sem preço de mercado. Pelo custo, com a margem típica de papelaria, fica ${brl(s)}.`)
    return { suggested: s, range: { min: shelfPriceAtLeast(cost * 1.6), max: shelfPriceAtLeast(cost * 2.4) }, notes }
  }

  let suggested = shelfPriceAtLeast(reference * (1 + markup))
  let rangeMin = shelfPriceAtLeast(reference)
  let rangeMax = shelfPriceAtLeast(Math.max(reference * (1 + markup * 2), marketMax ?? 0))
  if (suggested < floor) {
    suggested = shelfPriceAtLeast(floor)
    rangeMin = Math.max(rangeMin, suggested)
    rangeMax = Math.max(rangeMax, suggested)
    notes.push("Subi para manter margem mínima sobre o custo.")
  }
  return { suggested, range: { min: rangeMin, max: rangeMax }, notes }
}

/**
 * Sugestão a partir das ofertas. `byBarcode` = a pesquisa foi pelo código de
 * barras (aí o título da 1ª oferta vira o nome sugerido do produto).
 */
export function adviceFromOffers(offers: Offer[], ctx: Ctx, opts: { byBarcode: boolean }): AdviceCore {
  const cost = ctx.costPrice && ctx.costPrice > 0 ? ctx.costPrice : null
  const current = ctx.currentPrice && ctx.currentPrice > 0 ? ctx.currentPrice : null

  if (!offers.length) {
    const s = suggest(null, null, ctx)
    return {
      provider: "shopping",
      productName: null,
      brand: null,
      found: false,
      sources: [],
      market: { min: null, median: null, max: null },
      suggested: s.suggested,
      range: s.range,
      direction: [
        opts.byBarcode ? "Nenhuma loja encontrada para esse código." : "Nenhuma loja encontrada com esse nome.",
        opts.byBarcode ? "Digite o nome do produto e pesquise de novo." : "Tente um nome mais curto (marca + modelo).",
        ...s.notes,
      ].join(" "),
      confidence: "baixa",
      marginPct: s.suggested && cost ? Math.round(((s.suggested - cost) / s.suggested) * 100) : null,
      marketAbovePct: null,
    }
  }

  const prices = offers.map((o) => o.price)
  const market = { min: Math.min(...prices), median: median(prices), max: Math.max(...prices) }
  const s = suggest(market.median, market.max, ctx)
  const stores = [...new Set(offers.map((o) => o.store))]
  const storeTxt = stores.slice(0, 3).join(", ") + (stores.length > 3 ? "…" : "")
  const direction = [
    offers.length === 1
      ? `1 loja (${storeTxt}): ${brl(market.median)}.`
      : `${offers.length} ofertas (${storeTxt}): de ${brl(market.min)} a ${brl(market.max)}, no meio ${brl(market.median)}.`,
    s.suggested ? `Com o toque da loja (+${ctx.markupPct}%), sugerimos ${brl(s.suggested)}.` : "",
    opts.byBarcode ? "" : "Confira se é o mesmo tamanho/modelo.",
    ...s.notes,
  ]
    .filter(Boolean)
    .join(" ")

  const sources: PriceSource[] = offers.map((o) => ({
    loja: o.store,
    preco: o.price,
    tipo: o.physical ? "fisica" : "online",
    url: o.url,
  }))

  return {
    provider: "shopping",
    productName: opts.byBarcode ? prettyName(offers[0].title).slice(0, 160) : null,
    brand: null,
    found: true,
    sources,
    market,
    suggested: s.suggested,
    range: s.range,
    direction,
    confidence: offers.length >= 4 ? "alta" : offers.length >= 2 ? "media" : "baixa",
    marginPct: s.suggested && cost ? Math.round(((s.suggested - cost) / s.suggested) * 100) : null,
    marketAbovePct: current ? Math.round((market.median / current - 1) * 100) : null,
  }
}
