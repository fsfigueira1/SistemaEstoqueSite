// Pesquisa de preço de mercado — escolhe a fonte configurada:
//   "cosmos" (padrão, grátis): base Bluesoft Cosmos, preço médio no Brasil
//            pelo código de barras ou nome + regra do "toque da loja".
//   "claude" (pago): IA com pesquisa na web, considerando o perfil da loja.
// O resultado fica salvo em PriceCheck (cache) para não gastar consulta/crédito
// com a mesma pesquisa: 30 dias no Cosmos, 7 no Claude.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { getServerSettings } from "@/lib/serverSettings"
import type { PriceAdvice, PriceProvider, PriceSource } from "@/lib/priceAdvice"
import { claudeAdvice } from "@/services/pricing/claudeProvider"
import { COSMOS_DAILY_LIMIT, cosmosAdvice } from "@/services/pricing/cosmosProvider"

const CACHE_DAYS: Record<PriceProvider, number> = { cosmos: 30, claude: 7 }

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
    provider: row.provider === "cosmos" ? "cosmos" : "claude",
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
  const provider: PriceProvider = settings.priceProvider === "claude" ? "claude" : "cosmos"
  const query = normQuery(barcode || name || "")

  // cache: mesma pesquisa, mesma fonte, dentro do prazo
  if (!input.force) {
    const since = new Date(Date.now() - CACHE_DAYS[provider] * 86400000)
    const row = await prisma.priceCheck.findFirst({
      where: {
        createdAt: { gte: since },
        provider,
        ...(barcode ? { barcode } : { query }),
      },
      orderBy: { createdAt: "desc" },
    })
    if (row) {
      // associa ao produto se a pesquisa foi feita antes do cadastro
      if (input.productId && !row.productId) {
        await prisma.priceCheck.update({ where: { id: row.id }, data: { productId: input.productId } }).catch(() => {})
      }
      return { ...fromRow(row, input, true), quota: provider === "cosmos" ? await cosmosQuota() : undefined }
    }
  }

  const advice =
    provider === "claude"
      ? await claudeAdvice({ barcode, name, costPrice: input.costPrice, currentPrice: input.currentPrice }, settings)
      : await cosmosAdvice(
          { barcode, name, costPrice: input.costPrice, currentPrice: input.currentPrice },
          { token: settings.cosmosToken, markupPct: settings.priceMarkupPercent ?? 10 },
        )

  const row = await prisma.priceCheck.create({
    data: {
      provider,
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
  return {
    ...advice,
    id: row.id,
    checkedAt: row.createdAt.toISOString(),
    cached: false,
    quota: provider === "cosmos" ? await cosmosQuota() : undefined,
  }
}

/** Consultas ao Cosmos feitas hoje (todas as máquinas usam o mesmo token). */
async function cosmosQuota(): Promise<{ used: number; limit: number }> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const used = await prisma.priceCheck.count({ where: { provider: "cosmos", createdAt: { gte: start } } })
  return { used, limit: COSMOS_DAILY_LIMIT }
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
