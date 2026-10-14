import { prisma } from "../lib/prisma"
import type { ProductStatus } from "../generated/prisma/client.ts"
import { productSearchFields, smartSearch, suggestFor } from "../lib/smartSearch"

// Busca inteligente de produtos (ver lib/smartSearch): ranqueia em memória —
// o catálogo é de centenas/poucos milhares de itens, então basta uma consulta
// leve só com os campos de texto e depois buscar a página pedida.
export async function searchProductsRanked(
  where: { categoryId?: string; supplierId?: string; status?: ProductStatus },
  search: string,
  page: number,
  limit: number,
) {
  const rows = await prisma.product.findMany({
    where,
    select: { id: true, name: true, sku: true, barcode: true, category: { select: { name: true } }, supplier: { select: { name: true } } },
  })
  const ranked = smartSearch(rows, search, productSearchFields)
  const ids = ranked.slice((page - 1) * limit, page * limit).map((r) => r.id)
  const found = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { category: true, supplier: true },
  })
  const byId = new Map(found.map((p) => [p.id, p]))
  return {
    // nada encontrado: "Você quis dizer…?" com as palavras do catálogo
    suggestion: ranked.length ? null : suggestFor(rows, search, productSearchFields),
    products: ids.flatMap((id) => byId.get(id) ?? []),
    pagination: { total: ranked.length, page, limit, totalPages: Math.ceil(ranked.length / limit) },
  }
}
