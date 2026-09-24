// Pesquisa de preço gratuita pelo Cosmos (Bluesoft).
// Docs: https://cosmos.bluesoft.com.br/api — plano grátis: ~25 consultas/dia.
import { adviceFromGtin, adviceFromSearch, type AdviceCore, type CosmosProduct } from "@/lib/cosmosPricing"

// COSMOS_BASE_URL permite apontar para um simulador nos testes.
const BASE = (process.env.COSMOS_BASE_URL || "https://api.cosmos.bluesoft.com.br").replace(/\/$/, "")
const TIMEOUT_MS = 20_000
export const COSMOS_DAILY_LIMIT = 25

type Input = {
  barcode: string | null
  name: string | null
  costPrice?: number | null
  currentPrice?: number | null
}

async function cosmosGet(path: string, token: string): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: {
        "X-Cosmos-Token": token,
        "User-Agent": "Cosmos-API-Request",
        "Content-Type": "application/json",
      },
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) return { status: 404, data: null }
    // Mensagens no formato que src/lib/friendlyError.ts reconhece
    if (!res.ok) throw new Error(`Cosmos HTTP ${res.status}`)
    return { status: res.status, data }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("timeout na pesquisa de preço")
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function cosmosAdvice(input: Input, cfg: { token: string; markupPct: number }): Promise<AdviceCore> {
  const token = (cfg.token ?? "").trim()
  if (!token) throw new Error("cosmos token missing")
  const ctx = { costPrice: input.costPrice, currentPrice: input.currentPrice, markupPct: cfg.markupPct }

  // 1) pelo código de barras (o jeito certo: mesmo produto, mesma embalagem)
  if (input.barcode && /^\d{8,14}$/.test(input.barcode)) {
    const { status, data } = await cosmosGet(`/gtins/${encodeURIComponent(input.barcode)}.json`, token)
    if (status !== 404 && data) return adviceFromGtin(data as CosmosProduct, ctx)
  }
  // código interno / fora da base e sem nome: não há o que pesquisar
  if (!input.name) return adviceFromGtin(null, ctx)

  // 2) pelo nome (produtos parecidos)
  const q = input.name.trim()
  const { data } = await cosmosGet(`/products?query=${encodeURIComponent(q)}`, token)
  const items = Array.isArray((data as { products?: unknown })?.products)
    ? ((data as { products: CosmosProduct[] }).products)
    : Array.isArray(data)
      ? (data as CosmosProduct[])
      : []
  return adviceFromSearch(items, ctx)
}
