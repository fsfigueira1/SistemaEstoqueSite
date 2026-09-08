import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"
import { SaleService } from "@/services/saleService"
import { SaleStatus } from "@/generated/prisma/enums"

// GET /api/dashboard/stats - indicadores da tela inicial
export async function GET() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const { products } = await ProductService.getProducts({ limit: 100000 })

    const toNum = (v: unknown) =>
      typeof v === "number"
        ? v
        : v && typeof v === "object" && "toNumber" in v
          ? (v as { toNumber: () => number }).toNumber()
          : Number(v) || 0

    const activeProducts = products.filter((p) => p.status === "ACTIVE")
    const lowStock = activeProducts.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= (p.minStockLevel || 5),
    )
    const outOfStock = activeProducts.filter((p) => p.stockQuantity === 0)
    const stockValue = products.reduce(
      (sum, p) => sum + p.stockQuantity * toNum(p.costPrice),
      0,
    )

    const [todayStats, monthStats, recent] = await Promise.all([
      SaleService.getSalesStatistics({ startDate: startOfDay, status: SaleStatus.COMPLETED }),
      SaleService.getSalesStatistics({ startDate: startOfMonth, status: SaleStatus.COMPLETED }),
      SaleService.listSales({ limit: 8, page: 1 }),
    ])

    const recentSales = (recent?.sales ?? []).map((s: {
      id: string
      saleNumber?: string
      status: string
      totalAmount: number
      createdAt: Date | string
      customer?: { name?: string } | null
      items?: unknown[]
    }) => ({
      id: s.id,
      numero: s.saleNumber ?? s.id.slice(0, 8),
      status: s.status,
      total: toNum(s.totalAmount),
      itens: Array.isArray(s.items) ? s.items.length : 0,
      cliente: s.customer?.name ?? "Consumidor",
      data: s.createdAt,
    }))

    const lowStockList = [...lowStock, ...outOfStock]
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        nome: p.name,
        estoque: p.stockQuantity,
        minimo: p.minStockLevel ?? 5,
      }))

    return NextResponse.json({
      success: true,
      data: {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        stockValue,
        todayRevenue: todayStats.totals.totalAmount,
        todaySalesCount: todayStats.count,
        todayAvgTicket: todayStats.averages.totalAmount,
        monthRevenue: monthStats.totals.totalAmount,
        monthSalesCount: monthStats.count,
        recentSales,
        lowStockList,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
