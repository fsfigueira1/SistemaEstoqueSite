// Formato comum da pesquisa de preço (Google Shopping ou Claude) e leitura da resposta
// da IA. Sem acesso a banco/rede: usado pelo servidor e pela tela.

/** fisica = loja com retirada/estoque perto; online = loja na internet; referencia = base de preços. */
export type PriceSource = { loja: string; preco: number; tipo: "fisica" | "online" | "referencia"; url: string | null }

export type PriceProvider = "shopping" | "claude"

export type PriceAdvice = {
  id?: string
  provider: PriceProvider
  productName: string | null
  brand: string | null
  found: boolean
  sources: PriceSource[]
  market: { min: number | null; median: number | null; max: number | null }
  suggested: number | null
  range: { min: number | null; max: number | null }
  direction: string
  confidence: "alta" | "media" | "baixa"
  /** Margem sobre o preço sugerido, quando há custo. */
  marginPct: number | null
  /** Mercado acima do preço atual (em %), quando há preço atual. */
  marketAbovePct: number | null
  checkedAt: string
  cached: boolean
  /** Google Shopping (grátis): buscas usadas no mês x limite do plano. */
  quota?: { used: number; limit: number }
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 100) / 100
}

/** Pega o último objeto JSON de um texto (com ou sem bloco ```json). */
export function extractJson(text: string): unknown {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1])
  for (const block of fenced.reverse()) {
    try {
      return JSON.parse(block)
    } catch {
      /* tenta o próximo */
    }
  }
  // sem bloco: procura o último { ... } balanceado
  for (let end = text.lastIndexOf("}"); end >= 0; end = text.lastIndexOf("}", end - 1)) {
    let depth = 0
    for (let i = end; i >= 0; i--) {
      if (text[i] === "}") depth++
      else if (text[i] === "{") {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(i, end + 1))
          } catch {
            break
          }
        }
      }
    }
  }
  return null
}

/**
 * Menor preço de etiqueta >= v:
 *  - abaixo de R$ 1: múltiplo de 5 centavos
 *  - de R$ 1 a R$ 10: final ",50" ou ",90" (item barato não pula R$ 1 inteiro)
 *  - a partir de R$ 10: final ",90"
 */
export function shelfPriceAtLeast(v: number): number {
  if (v <= 0) return 0
  const cents = Math.round(v * 100)
  if (cents < 100) return (Math.ceil(cents / 5) * 5) / 100
  if (cents < 1000) {
    const whole = Math.floor(cents / 100)
    const frac = cents - whole * 100
    if (frac <= 50) return (whole * 100 + 50) / 100
    if (frac <= 90) return (whole * 100 + 90) / 100
    return (whole * 100 + 150) / 100
  }
  const whole = Math.ceil((cents - 90) / 100)
  return (whole * 100 + 90) / 100
}

/**
 * Normaliza a resposta crua da IA. Nunca confia cegamente: recalcula a
 * mediana a partir dos preços achados, coloca a sugestão dentro da faixa e
 * garante margem mínima sobre o custo.
 */
export function normalizeAdvice(
  raw: unknown,
  ctx: { costPrice?: number | null; currentPrice?: number | null; minMarkup?: number },
): Omit<PriceAdvice, "checkedAt" | "cached" | "id"> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const produto = (r.produto ?? {}) as Record<string, unknown>
  const mercado = (r.mercado ?? {}) as Record<string, unknown>
  const sugestao = (r.sugestao ?? {}) as Record<string, unknown>

  const sources: PriceSource[] = Array.isArray(r.precos)
    ? (r.precos as Array<Record<string, unknown>>)
        .map((p) => ({
          loja: String(p.loja ?? "").trim().slice(0, 80),
          preco: num(p.preco) ?? 0,
          tipo: (p.tipo === "fisica" ? "fisica" : "online") as PriceSource["tipo"],
          url: typeof p.url === "string" && /^https?:\/\//.test(p.url) ? p.url : null,
        }))
        .filter((p) => p.loja && p.preco > 0)
        .slice(0, 12)
    : []

  const prices = sources.map((s) => s.preco)
  const market = {
    min: prices.length ? Math.min(...prices) : num(mercado.minimo),
    median: median(prices) ?? num(mercado.mediana),
    max: prices.length ? Math.max(...prices) : num(mercado.maximo),
  }

  let suggested = num(sugestao.preco)
  let rMin = num(sugestao.faixaMin)
  let rMax = num(sugestao.faixaMax)
  if (rMin && rMax && rMin > rMax) [rMin, rMax] = [rMax, rMin]
  if (suggested && rMin && suggested < rMin) suggested = rMin
  if (suggested && rMax && suggested > rMax) suggested = rMax

  // nunca abaixo do custo + margem mínima
  const cost = ctx.costPrice && ctx.costPrice > 0 ? ctx.costPrice : null
  const floor = cost ? Math.round(cost * (1 + (ctx.minMarkup ?? 0.3)) * 100) / 100 : null
  let direction = String(r.direcao ?? "").trim().slice(0, 400)
  if (suggested && floor && suggested < floor) {
    suggested = shelfPriceAtLeast(floor)
    if (rMin && rMin < floor) rMin = suggested
    if (rMax && rMax < suggested) rMax = suggested
    direction = `${direction} Ajustado para manter margem mínima sobre o custo.`.trim()
  }

  const confidence = (["alta", "media", "baixa"].includes(String(r.confianca)) ? r.confianca : "baixa") as PriceAdvice["confidence"]
  const current = ctx.currentPrice && ctx.currentPrice > 0 ? ctx.currentPrice : null

  return {
    provider: "claude",
    productName: typeof produto.nome === "string" && produto.nome.trim() ? produto.nome.trim().slice(0, 160) : null,
    brand: typeof produto.marca === "string" && produto.marca.trim() ? produto.marca.trim().slice(0, 60) : null,
    found: produto.encontrado === true,
    sources,
    market,
    suggested,
    range: { min: rMin, max: rMax },
    direction: direction || (suggested ? "Preço dentro do que o mercado pratica." : "Não achei preços confiáveis."),
    confidence,
    marginPct: suggested && cost ? Math.round(((suggested - cost) / suggested) * 100) : null,
    marketAbovePct: market.median && current ? Math.round((market.median / current - 1) * 100) : null,
  }
}

/** Código de barras comercial (EAN-8, UPC-12, EAN-13, DUN-14) com dígito verificador válido. */
export function isValidGtin(code: string): boolean {
  const c = code.replace(/\D/g, "")
  if (![8, 12, 13, 14].includes(c.length) || c !== code.trim()) return false
  const digits = c.split("").map(Number)
  const check = digits[digits.length - 1]
  const sum = digits
    .slice(0, -1)
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}
