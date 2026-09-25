// Sugestão de compra: soma o que cada produto vendeu no período (vendas
// concluídas) e aplica a regra de src/lib/restock.ts.
import { prisma } from "@/lib/prisma"
import { buildRestockPlan, type RestockPlan } from "@/lib/restock"

const num = (v: unknown) => {
  if (v == null) return 0
  if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber: () => number }).toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function getRestockPlan(days = 30, cover = 30): Promise<RestockPlan> {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - days + 1)

  const [sold, products] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, sale: { status: "COMPLETED", createdAt: { gte: since } } },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        stockQuantity: true,
        minStockLevel: true,
        maxStockLevel: true,
        costPrice: true,
        unit: true,
        supplier: { select: { id: true, name: true, phone: true, contactName: true } },
      },
    }),
  ])

  const soldById = new Map<string, number>()
  for (const s of sold) if (s.productId) soldById.set(s.productId, s._sum.quantity ?? 0)

  return buildRestockPlan(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      stock: p.stockQuantity,
      min: p.minStockLevel ?? 0,
      max: p.maxStockLevel,
      cost: num(p.costPrice),
      unit: p.unit,
      supplier: p.supplier,
    })),
    soldById,
    days,
    cover,
  )
}
