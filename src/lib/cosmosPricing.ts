// Pesquisa de preço gratuita via Cosmos (Bluesoft) — só a parte "pura":
// ler a resposta da API e transformar em sugestão de preço. Sem rede/banco.
//
// O Cosmos é um cadastro brasileiro de códigos de barras. Pelo GTIN ele
// devolve nome, marca e preço médio/mínimo/máximo praticado no Brasil. Pela
// busca por nome devolve uma lista de produtos parecidos, cada um com o seu
// preço médio.
//
// Regra da sugestão (sem IA):
//   preço de referência = preço médio (ou mediana dos parecidos)
//   sugestão = referência + "toque da loja" (%), arredondada para cima em ",90"
//   nunca abaixo de custo + 30%
//   sem preço de mercado mas com custo → custo × 2 (margem típica de papelaria)
import { shelfPriceAtLeast, type PriceAdvice, type PriceSource } from "@/lib/priceAdvice"

export type CosmosProduct = {
  gtin?: number | string | null
  description?: string | null
  brand?: { name?: string | null } | null
  avg_price?: number | string | null
  min_price?: number | string | null
  max_price?: number | string | null
  price?: string | null
  thumbnail?: string | null
}

export type AdviceCore = Omit<PriceAdvice, "checkedAt" | "cached" | "id">

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
  // "R$ 2,99" ou "1.234,56" ou "2.99"
  const s = String(v).replace(/[^\d,.]/g, "")
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 100) / 100
}

const SMALL = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "em", "a", "o", "p/", "c/"])

/**
 * O Cosmos devolve nomes em MAIÚSCULAS ("CADERNO TILIBRA 10 MATERIAS").
 * Deixa com cara de etiqueta: "Caderno Tilibra 10 Materias". Medidas com
 * número ficam em minúsculas ("1kg", "500ml"); nomes já em caixa mista ficam como estão.
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

/** Preço médio de um item do Cosmos (avg_price, ou o texto "R$ x,xx"). */
export function cosmosAvg(p: CosmosProduct): number | null {
  return money(p.avg_price) ?? money(p.price)
}

function productUrl(gtin: unknown): string | null {
  const g = String(gtin ?? "").replace(/\D/g, "")
  return g ? `https://cosmos.bluesoft.com.br/produtos/${g}` : null
}

type Ctx = {
  costPrice?: number | null
  currentPrice?: number | null
  /** "Toque da loja" em % sobre o preço médio. */
  markupPct: number
}

function suggest(reference: number | null, marketMax: number | null, ctx: Ctx) {
  const cost = ctx.costPrice && ctx.costPrice > 0 ? ctx.costPrice : null
  const floor = cost ? cost * 1.3 : 0
  const markup = Math.max(0, ctx.markupPct) / 100
  const notes: string[] = []

  if (!reference) {
    if (!cost) return { suggested: null, range: { min: null, max: null }, notes }
    const s = shelfPriceAtLeast(cost * 2)
    notes.push(`Sem preço de mercado na base. Pelo custo, com a margem típica de papelaria, fica ${brl(s)}.`)
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

function finish(core: Omit<AdviceCore, "marginPct" | "marketAbovePct">, ctx: Ctx): AdviceCore {
  const cost = ctx.costPrice && ctx.costPrice > 0 ? ctx.costPrice : null
  const current = ctx.currentPrice && ctx.currentPrice > 0 ? ctx.currentPrice : null
  return {
    ...core,
    marginPct: core.suggested && cost ? Math.round(((core.suggested - cost) / core.suggested) * 100) : null,
    marketAbovePct: core.market.median && current ? Math.round((core.market.median / current - 1) * 100) : null,
  }
}

/** Resultado da consulta por código de barras (um produto só). */
export function adviceFromGtin(p: CosmosProduct | null, ctx: Ctx): AdviceCore {
  if (!p || !p.description) {
    const s = suggest(null, null, ctx)
    return finish(
      {
        provider: "cosmos",
        productName: null,
        brand: null,
        found: false,
        sources: [],
        market: { min: null, median: null, max: null },
        suggested: s.suggested,
        range: s.range,
        direction: ["Código não encontrado na base de preços.", ...s.notes].join(" "),
        confidence: "baixa",
      },
      ctx,
    )
  }
  const avg = cosmosAvg(p)
  const min = money(p.min_price) ?? avg
  const max = money(p.max_price) ?? avg
  const s = suggest(avg, max, ctx)
  const markupTxt = ctx.markupPct > 0 ? ` Com o toque da loja (+${ctx.markupPct}%)` : " Pelo preço médio"
  const direction = avg
    ? [
        `Preço médio no Brasil: ${brl(avg)}${min && max && (min !== avg || max !== avg) ? ` (de ${brl(min)} a ${brl(max)})` : ""}.`,
        s.suggested ? `${markupTxt}, sugerimos ${brl(s.suggested)}.` : "",
        ...s.notes,
      ]
        .filter(Boolean)
        .join(" ")
    : ["Produto encontrado, mas a base não tem preço para ele.", ...s.notes].join(" ")

  const sources: PriceSource[] = avg
    ? [{ loja: "Preço médio no Brasil (Cosmos)", preco: avg, tipo: "referencia", url: productUrl(p.gtin) }]
    : []
  if (avg && min && min !== avg) sources.push({ loja: "Menor preço registrado", preco: min, tipo: "referencia", url: null })
  if (avg && max && max !== avg) sources.push({ loja: "Maior preço registrado", preco: max, tipo: "referencia", url: null })

  return finish(
    {
      provider: "cosmos",
      productName: prettyName(p.description).slice(0, 160),
      brand: p.brand?.name?.trim() || null,
      found: true,
      sources,
      market: { min: avg ? min : null, median: avg, max: avg ? max : null },
      suggested: s.suggested,
      range: s.range,
      direction,
      confidence: avg ? (money(p.min_price) && money(p.max_price) ? "alta" : "media") : "baixa",
    },
    ctx,
  )
}

/** Resultado da busca por nome (vários produtos parecidos). */
export function adviceFromSearch(items: CosmosProduct[], ctx: Ctx): AdviceCore {
  const priced = items
    .map((p) => ({ p, avg: cosmosAvg(p) }))
    .filter((x): x is { p: CosmosProduct; avg: number } => x.avg != null && Boolean(x.p.description))
    .slice(0, 8)

  if (!priced.length) {
    const s = suggest(null, null, ctx)
    return finish(
      {
        provider: "cosmos",
        productName: null,
        brand: null,
        found: items.length > 0,
        sources: [],
        market: { min: null, median: null, max: null },
        suggested: s.suggested,
        range: s.range,
        direction: [
          items.length ? "Achei produtos parecidos, mas sem preço na base." : "Nenhum produto parecido na base de preços.",
          "Tente pelo código de barras.",
          ...s.notes,
        ].join(" "),
        confidence: "baixa",
      },
      ctx,
    )
  }

  const prices = priced.map((x) => x.avg)
  const market = { min: Math.min(...prices), median: median(prices), max: Math.max(...prices) }
  const s = suggest(market.median, market.max, ctx)
  const direction = [
    `${priced.length} ${priced.length === 1 ? "produto parecido" : "produtos parecidos"} na base: ${brl(market.min)} a ${brl(market.max)} (meio: ${brl(market.median)}).`,
    s.suggested ? `Com o toque da loja (+${ctx.markupPct}%), sugerimos ${brl(s.suggested)}.` : "",
    "Confira se é o mesmo tamanho/modelo.",
    ...s.notes,
  ]
    .filter(Boolean)
    .join(" ")

  return finish(
    {
      provider: "cosmos",
      productName: null,
      brand: null,
      found: true,
      sources: priced.map(({ p, avg }) => ({
        loja: prettyName(String(p.description)).slice(0, 80),
        preco: avg,
        tipo: "referencia" as const,
        url: productUrl(p.gtin),
      })),
      market,
      suggested: s.suggested,
      range: s.range,
      direction,
      confidence: priced.length >= 3 ? "media" : "baixa",
    },
    ctx,
  )
}
