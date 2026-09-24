// Sugestão de preço com IA (Claude + pesquisa na web).
//
// Fluxo: recebe código de barras e/ou nome → o Claude pesquisa o produto e os
// preços praticados no Brasil (prioriza lojas físicas / papelarias) → devolve
// uma faixa de mercado, um preço recomendado para ESTA loja (perfil em
// Configurações) e uma frase de direção. O resultado fica salvo em PriceCheck
// por 7 dias para não pagar a mesma pesquisa duas vezes.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { getServerSettings } from "@/lib/serverSettings"
import { extractJson, normalizeAdvice, type PriceAdvice, type PriceSource } from "@/lib/priceAdvice"

// ANTHROPIC_BASE_URL permite apontar para um proxy da empresa (ou um simulador nos testes).
const API_URL = `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`
const CACHE_DAYS = 7
const TIMEOUT_MS = 120_000

export type AdviceInput = {
  barcode?: string | null
  name?: string | null
  productId?: string | null
  costPrice?: number | null
  currentPrice?: number | null
  force?: boolean
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber: () => number }).toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normQuery = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

type CheckRow = Awaited<ReturnType<typeof prisma.priceCheck.findFirst>>

function fromRow(row: NonNullable<CheckRow>, ctx: { currentPrice?: number | null; costPrice?: number | null }, cached: boolean): PriceAdvice {
  const median = toNum(row.marketMedian)
  const suggested = toNum(row.suggestedPrice)
  const cost = ctx.costPrice && ctx.costPrice > 0 ? ctx.costPrice : toNum(row.costPrice)
  const current = ctx.currentPrice && ctx.currentPrice > 0 ? ctx.currentPrice : null
  return {
    id: row.id,
    productName: row.productName,
    brand: row.brand,
    found: Boolean(row.productName),
    sources: (Array.isArray(row.sources) ? row.sources : []) as PriceSource[],
    market: { min: toNum(row.marketMin), median, max: toNum(row.marketMax) },
    suggested,
    range: { min: toNum(row.rangeMin), max: toNum(row.rangeMax) },
    direction: row.direction ?? "",
    confidence: (row.confidence as PriceAdvice["confidence"]) ?? "baixa",
    marginPct: suggested && cost ? Math.round(((suggested - cost) / suggested) * 100) : null,
    marketAbovePct: median && current ? Math.round((median / current - 1) * 100) : null,
    checkedAt: row.createdAt.toISOString(),
    cached,
  }
}

function buildPrompt(input: AdviceInput, settings: { storeProfile: string; storeCity: string; companyAddress: string }) {
  const lines: string[] = []
  if (input.barcode) lines.push(`Código de barras (EAN/GTIN): ${input.barcode}`)
  if (input.name) lines.push(`Nome informado no cadastro: ${input.name}`)
  if (input.costPrice && input.costPrice > 0) lines.push(`Preço de custo da loja: R$ ${input.costPrice.toFixed(2)}`)
  if (input.currentPrice && input.currentPrice > 0) lines.push(`Preço de venda atual na loja: R$ ${input.currentPrice.toFixed(2)}`)
  const where = settings.storeCity || settings.companyAddress
  return `Preciso de uma direção de preço de venda para um produto que vou cadastrar na minha papelaria.

PRODUTO
${lines.join("\n")}

MINHA LOJA
${settings.storeProfile}
${where ? `Localização: ${where}` : "Localização: Brasil"}

O QUE FAZER
1. ${input.barcode ? `Pesquise o código de barras ${input.barcode} para confirmar exatamente qual produto é (nome, marca, tamanho/quantidade). Se o código não trouxer nada, use o nome informado.` : "Identifique o produto pelo nome (marca, tamanho/quantidade)."}
2. Pesquise o preço de venda atual desse mesmo produto (mesma embalagem/quantidade) em lojas do Brasil. Priorize papelarias e lojas físicas (preço de prateleira, ex.: Kalunga, papelarias de bairro, redes de varejo com loja física); use grandes lojas online como referência. Ignore usados, kits/atacado e anúncios com preço fora da curva.
3. Recomende o preço de prateleira para a MINHA loja, considerando o perfil acima (pode ficar um pouco acima da média quando o posicionamento justificar), com final ",90". Se houver custo, mantenha margem saudável para papelaria e nunca abaixo de custo + 30%.
4. Seja breve: a "direcao" tem no máximo 2 frases curtas, em português simples, falando direto com a dona da loja.

Responda SOMENTE com um bloco \`\`\`json neste formato (números em reais, com ponto decimal):
\`\`\`json
{
  "produto": { "nome": "nome completo do produto ou null", "marca": "marca ou null", "encontrado": true },
  "precos": [ { "loja": "nome da loja", "preco": 0.00, "tipo": "fisica ou online", "url": "link ou null" } ],
  "mercado": { "minimo": 0.00, "mediana": 0.00, "maximo": 0.00 },
  "sugestao": { "preco": 0.00, "faixaMin": 0.00, "faixaMax": 0.00 },
  "direcao": "frase curta",
  "confianca": "alta, media ou baixa"
}
\`\`\`
Se não achar preços confiáveis, use "encontrado": false, "precos": [] e "confianca": "baixa", e dê a melhor estimativa com base em produtos parecidos.`
}

type ContentBlock = { type: string; text?: string; content?: unknown }
type ApiResponse = { content?: ContentBlock[]; stop_reason?: string; error?: { type?: string; message?: string } }

async function callClaude(apiKey: string, model: string, prompt: string, city: string): Promise<{ text: string; searchSources: PriceSource[] }> {
  const location: Record<string, string> = { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" }
  const cityName = city.split(/[/,-]/)[0]?.trim()
  if (cityName) location.city = cityName

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [{ role: "user", content: prompt }]
  const blocks: ContentBlock[] = []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // "pause_turn" = a pesquisa ainda está rodando; reenviamos para continuar.
    for (let round = 0; round < 4; round++) {
      const res = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2500,
          system:
            "Você é consultor de precificação de varejo para papelarias no Brasil. Pesquisa preços reais na web, é objetivo e responde em português do Brasil.",
          messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: location }],
        }),
      })
      const data = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok) {
        const type = data?.error?.type ?? ""
        const msg = data?.error?.message ?? ""
        throw new Error(`Anthropic HTTP ${res.status}: ${type} ${msg}`.trim())
      }
      const content = data.content ?? []
      blocks.push(...content)
      if (data.stop_reason !== "pause_turn") break
      messages.push({ role: "assistant", content })
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("timeout na pesquisa de preço")
    throw err
  } finally {
    clearTimeout(timer)
  }

  const text = blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")

  // fontes das pesquisas (usadas se a IA não listar lojas)
  const searchSources: PriceSource[] = []
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as Array<{ url?: string; title?: string }>) {
        if (r.url) searchSources.push({ loja: (r.title ?? r.url).slice(0, 80), preco: 0, tipo: "online", url: r.url })
      }
    }
  }
  return { text, searchSources }
}

/** Última pesquisa salva (para mostrar sem gastar uma nova). */
export async function getLatestAdvice(input: AdviceInput): Promise<PriceAdvice | null> {
  await ensureSchema()
  const barcode = input.barcode?.trim() || null
  const query = normQuery(barcode || input.name || "")
  if (!input.productId && !query) return null
  const row = await prisma.priceCheck.findFirst({
    where: input.productId ? { productId: input.productId } : barcode ? { barcode } : { query },
    orderBy: { createdAt: "desc" },
  })
  return row ? fromRow(row, input, true) : null
}

export async function suggestPrice(input: AdviceInput): Promise<PriceAdvice> {
  await ensureSchema()
  const barcode = input.barcode?.trim() || null
  const name = input.name?.trim() || null
  if (!barcode && !name) throw new Error("Informe o código de barras ou o nome do produto (obrigatório)")

  const settings = await getServerSettings()
  const apiKey = (settings.aiApiKey ?? "").trim()
  if (!apiKey) throw new Error("ai key missing")

  const query = normQuery(barcode || name || "")

  // cache: mesma pesquisa nos últimos 7 dias
  if (!input.force) {
    const since = new Date(Date.now() - CACHE_DAYS * 86400000)
    const row = await prisma.priceCheck.findFirst({
      where: { createdAt: { gte: since }, ...(barcode ? { barcode } : { query }) },
      orderBy: { createdAt: "desc" },
    })
    if (row) {
      // associa ao produto se a pesquisa foi feita antes do cadastro
      if (input.productId && !row.productId) {
        await prisma.priceCheck.update({ where: { id: row.id }, data: { productId: input.productId } }).catch(() => {})
      }
      return fromRow(row, input, true)
    }
  }

  const prompt = buildPrompt({ ...input, barcode, name }, settings)
  const { text, searchSources } = await callClaude(apiKey, settings.aiModel || "claude-sonnet-5", prompt, settings.storeCity || "")
  const raw = extractJson(text)
  if (!raw) throw new Error("A IA respondeu num formato inesperado (invalid)")

  const advice = normalizeAdvice(raw, { costPrice: input.costPrice, currentPrice: input.currentPrice })
  if (!advice.sources.length && searchSources.length) {
    // sem preços estruturados: guarda ao menos os links consultados
    advice.sources = searchSources.slice(0, 6)
  }

  const row = await prisma.priceCheck.create({
    data: {
      productId: input.productId || null,
      barcode,
      query,
      productName: advice.productName,
      brand: advice.brand,
      currentPrice: input.currentPrice ?? null,
      costPrice: input.costPrice ?? null,
      suggestedPrice: advice.suggested,
      rangeMin: advice.range.min,
      rangeMax: advice.range.max,
      marketMin: advice.market.min,
      marketMedian: advice.market.median,
      marketMax: advice.market.max,
      direction: advice.direction,
      confidence: advice.confidence,
      sources: advice.sources as unknown as object,
    },
  })
  return { ...advice, id: row.id, checkedAt: row.createdAt.toISOString(), cached: false }
}

/**
 * Produtos cujo preço de mercado (última pesquisa) está acima do preço da
 * loja além do limite configurado — o "aviso de alta".
 */
export async function getPriceAlerts(): Promise<
  Array<{ productId: string; name: string; salePrice: number; marketMedian: number; suggested: number | null; abovePct: number; checkedAt: string }>
> {
  await ensureSchema()
  const settings = await getServerSettings()
  const limit = 1 + (settings.priceAlertPercent ?? 10) / 100
  const checks = await prisma.priceCheck.findMany({
    where: { productId: { not: null }, marketMedian: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  const latest = new Map<string, (typeof checks)[number]>()
  for (const c of checks) if (c.productId && !latest.has(c.productId)) latest.set(c.productId, c)
  if (!latest.size) return []
  const products = await prisma.product.findMany({
    where: { id: { in: [...latest.keys()] }, status: "ACTIVE" },
    select: { id: true, name: true, salePrice: true },
  })
  return products
    .flatMap((p) => {
      const c = latest.get(p.id)
      if (!c) return []
      const price = toNum(p.salePrice) ?? 0
      const median = toNum(c.marketMedian) ?? 0
      return {
        productId: p.id,
        name: p.name,
        salePrice: price,
        marketMedian: median,
        suggested: toNum(c.suggestedPrice),
        abovePct: price > 0 ? Math.round((median / price - 1) * 100) : 0,
        checkedAt: c.createdAt.toISOString(),
        _alert: price > 0 && median > price * limit,
      }
    })
    .filter((a) => a._alert)
    .map(({ _alert, ...a }) => a)
    .sort((a, b) => b.abovePct - a.abovePct)
}
