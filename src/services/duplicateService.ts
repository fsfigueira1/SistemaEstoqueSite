// Produtos duplicados: listar e juntar. Juntar = o histórico (vendas, estoque,
// compras, preços) dos outros passa para o produto escolhido, o estoque soma
// e os outros são apagados. Tudo numa transação.
import { prisma } from "@/lib/prisma"
import { getSystemUserId } from "@/lib/systemUser"
import { findDuplicates } from "@/lib/duplicates"

export type DupItem = {
  id: string
  name: string
  barcode: string | null
  sku: string
  salePrice: number
  costPrice: number
  stock: number
  status: string
  sales: number
  createdAt: string
}
export type DupView = { reason: string; items: DupItem[] }

export async function listDuplicates(): Promise<DupView[]> {
  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, barcode: true, sku: true, salePrice: true, costPrice: true,
      stockQuantity: true, status: true, createdAt: true, _count: { select: { saleItems: true } },
    },
  })
  const byId = new Map(products.map((p) => [p.id, p]))
  return findDuplicates(products).map((g) => ({
    reason: g.reason,
    items: g.ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        sku: p.sku,
        salePrice: Number(p.salePrice),
        costPrice: Number(p.costPrice),
        stock: p.stockQuantity,
        status: p.status,
        sales: p._count.saleItems,
        createdAt: p.createdAt.toISOString(),
      })),
  }))
}

export async function mergeProducts(keepId: string, removeIds: string[]) {
  const others = [...new Set(removeIds)].filter((id) => id && id !== keepId)
  if (!keepId || !others.length) throw new Error("Escolha o produto que fica e os que saem")
  const userId = await getSystemUserId()
  return prisma.$transaction(async (tx) => {
    const keep = await tx.product.findUnique({ where: { id: keepId } })
    if (!keep) throw new Error("Produto não encontrado")
    const gone = await tx.product.findMany({ where: { id: { in: others } } })
    if (gone.length !== others.length) throw new Error("Produto não encontrado")
    const where = { productId: { in: others } }
    await tx.saleItem.updateMany({ where, data: { productId: keepId } })
    await tx.stockMovement.updateMany({ where, data: { productId: keepId } })
    await tx.purchaseOrderItem.updateMany({ where, data: { productId: keepId } })
    await tx.priceHistory.updateMany({ where, data: { productId: keepId } })
    await tx.priceCheck.updateMany({ where, data: { productId: keepId } })
    const extraStock = gone.reduce((n, p) => n + p.stockQuantity, 0)
    // se o que fica não tem código de barras, herda o do primeiro que tiver
    const barcode = keep.barcode ?? gone.find((p) => p.barcode)?.barcode ?? null
    await tx.product.deleteMany({ where: { id: { in: others } } })
    const updated = await tx.product.update({
      where: { id: keepId },
      data: { stockQuantity: { increment: extraStock }, ...(barcode && !keep.barcode ? { barcode } : {}) },
    })
    await tx.auditLog.create({
      data: {
        userId,
        action: "PRODUCTS_MERGED",
        entity: "Product",
        entityId: keepId,
        metadata: { removed: gone.map((p) => ({ id: p.id, name: p.name, barcode: p.barcode, stock: p.stockQuantity })) },
      },
    })
    return { id: updated.id, stock: updated.stockQuantity, removed: gone.length }
  })
}
