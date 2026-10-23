// Ajudante com IA: junta os números da loja (só leitura) que vão no contexto
// de cada pergunta — vendas por período, mais vendidos, estoque baixo, sem
// estoque e parados. Testado em tests/assistantService.test.ts.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { getServerSettings } from "@/lib/serverSettings"
import { METHOD_OF, toNum } from "@/services/reportService"
import type { AssistantContext, PeriodSummary } from "@/lib/assistantPrompt"

const DAY = 24 * 3600_000
const LIST_MAX = 15
const r2 = (v: number) => Math.round(v * 100) / 100

type SaleRow = { totalAmount: unknown; createdAt: Date; payments: Array<{ method: string; amount: unknown; status: string }> }

function summarize(sales: SaleRow[]): PeriodSummary {
  const s = { vendas: sales.length, faturamento: 0, ticketMedio: 0, dinheiro: 0, cartao: 0, pix: 0 }
  for (const sale of sales) {
    s.faturamento += toNum(sale.totalAmount)
    for (const p of sale.payments) {
      if (p.status === "REFUNDED") continue
      const k = METHOD_OF[p.method]
      if (k === "cash") s.dinheiro += toNum(p.amount)
      else if (k === "card") s.cartao += toNum(p.amount)
      else if (k === "pix") s.pix += toNum(p.amount)
    }
  }
  s.ticketMedio = s.vendas ? s.faturamento / s.vendas : 0
  return { ...s, faturamento: r2(s.faturamento), ticketMedio: r2(s.ticketMedio), dinheiro: r2(s.dinheiro), cartao: r2(s.cartao), pix: r2(s.pix) }
}

export async function buildAssistantContext(now = new Date()): Promise<AssistantContext> {
  await ensureSchema()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const at = (days: number) => new Date(today.getTime() - days * DAY)
  // janelas contando o dia de hoje: últimos 7 = hoje e os 6 anteriores
  const since60 = at(59)

  const [settings, sales, items, products] = await Promise.all([
    getServerSettings(),
    prisma.sale.findMany({
      where: { status: "COMPLETED", createdAt: { gte: at(59), lte: now } },
      select: { totalAmount: true, createdAt: true, payments: { select: { method: true, amount: true, status: true } } },
    }),
    prisma.saleItem.findMany({
      where: { sale: { status: "COMPLETED" }, createdAt: { gte: since60, lte: now } },
      select: { productId: true, productName: true, quantity: true, totalAmount: true, createdAt: true, product: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, stockQuantity: true, minStockLevel: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
  ])

  const between = (from: Date, to: Date) => sales.filter((s) => s.createdAt >= from && s.createdAt < to)
  const end = new Date(now.getTime() + 1)

  const top = new Map<string, { nome: string; quantidade: number; total: number }>()
  const soldIds = new Set<string>()
  for (const it of items) {
    if (it.productId) soldIds.add(it.productId)
    if (it.createdAt < at(29)) continue
    const nome = it.product?.name ?? it.productName ?? "Item avulso"
    const cur = top.get(nome) ?? { nome, quantidade: 0, total: 0 }
    cur.quantidade += it.quantity
    cur.total = r2(cur.total + toNum(it.totalAmount))
    top.set(nome, cur)
  }

  return {
    loja: settings.companyName || "loja",
    agora: now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    hoje: summarize(between(today, end)),
    ultimos7: summarize(between(at(6), end)),
    anteriores7: summarize(between(at(13), at(6))),
    ultimos30: summarize(between(at(29), end)),
    anteriores30: summarize(between(at(59), at(29))),
    maisVendidos30: [...top.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, LIST_MAX),
    estoqueBaixo: products
      .filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel)
      .slice(0, LIST_MAX)
      .map((p) => ({ nome: p.name, estoque: p.stockQuantity, minimo: p.minStockLevel })),
    semEstoque: products.filter((p) => p.stockQuantity <= 0).slice(0, LIST_MAX).map((p) => p.name),
    parados: products
      // cadastrado há mais de 60 dias e sem venda nesse tempo (o que acabou de chegar não conta)
      .filter((p) => p.stockQuantity > 0 && !soldIds.has(p.id) && p.createdAt < since60)
      .sort((a, b) => b.stockQuantity - a.stockQuantity)
      .slice(0, LIST_MAX)
      .map((p) => ({ nome: p.name, estoque: p.stockQuantity })),
  }
}
