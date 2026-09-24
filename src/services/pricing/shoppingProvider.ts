// Pesquisa de preço gratuita pelo Google Shopping, via SerpApi.
// Plano grátis: 250 buscas/mês, sem cartão (https://serpapi.com/pricing).
// Docs: https://serpapi.com/google-shopping-api
import { adviceFromOffers, offersFromSerp, type AdviceCore, type SerpShoppingItem } from "@/lib/shoppingPricing"

// SERPAPI_BASE_URL permite apontar para um simulador nos testes.
const BASE = (process.env.SERPAPI_BASE_URL || "https://serpapi.com").replace(/\/$/, "")
const TIMEOUT_MS = 30_000
export const SHOPPING_FREE_MONTHLY = 250

type Input = {
  barcode: string | null
  name: string | null
  costPrice?: number | null
  currentPrice?: number | null
}

async function serpGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { signal: controller.signal })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    // Mensagens no formato que src/lib/friendlyError.ts reconhece
    if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}: ${String(data?.error ?? "")}`.trim())
    return data
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("timeout na pesquisa de preço")
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function shoppingAdvice(input: Input, cfg: { apiKey: string; markupPct: number }): Promise<AdviceCore> {
  const apiKey = (cfg.apiKey ?? "").trim()
  if (!apiKey) throw new Error("shopping key missing")

  // Nome digitado é o que o Google Shopping entende melhor; sem nome (acabou
  // de bipar), pesquisa o código de barras — o Google acha o produto pelo EAN.
  const byBarcode = !input.name && Boolean(input.barcode)
  const q = (input.name || input.barcode || "").trim()

  const data = await serpGet("/search.json", {
    engine: "google_shopping",
    q,
    gl: "br",
    hl: "pt-br",
    google_domain: "google.com.br",
    location: "Brazil",
    api_key: apiKey,
  })
  // "Google hasn't returned any results" vem como `error` com HTTP 200: é só "nada achado".
  const items = Array.isArray(data.shopping_results) ? (data.shopping_results as SerpShoppingItem[]) : []
  const offers = offersFromSerp(items, q)
  return adviceFromOffers(offers, { costPrice: input.costPrice, currentPrice: input.currentPrice, markupPct: cfg.markupPct }, { byBarcode })
}

/** Buscas usadas/disponíveis no mês (a consulta da conta não gasta busca). */
export async function shoppingQuota(apiKey: string): Promise<{ used: number; limit: number } | null> {
  try {
    const a = await serpGet("/account.json", { api_key: apiKey })
    const limit = Number(a.searches_per_month)
    const left = Number(a.plan_searches_left ?? a.total_searches_left)
    const used = Number(a.this_month_usage)
    if (Number.isFinite(limit) && limit > 0) {
      return { used: Number.isFinite(used) ? used : Math.max(0, limit - left), limit }
    }
  } catch {
    /* sem a conta, sem contador — não atrapalha a pesquisa */
  }
  return null
}
