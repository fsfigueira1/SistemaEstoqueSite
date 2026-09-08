import { NextResponse } from "next/server"
import { ProductService } from "@/services/services/productService"
import SaleService from "@/services/services/saleService"
import StockService from "@/services/services/stockService"


// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: Request) {
  try {
    // Get inventory stats
    const products = await ProductService.getProducts({ limit: 10000 })

    const lowStockProducts = products.products.filter(
      p => p.stockQuantity > 0 && p.stockQuantity <= (p.minStockLevel || 5)
    ).length

    const outOfStockProducts = products.products.filter(
      p => p.stockQuantity === 0
    ).length

    // Get today's sales stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const salesResult = await SaleService.listSales({
      startDate: today,
      limit: 1000
    })

    const salesToday = salesResult?.sales || []
    const todaySalesFiltered = salesToday.filter(sale =>
      new Date(sale.createdAt).toDateString() === today.toDateString()
    )

    const todayRevenue = todaySalesFiltered.reduce((sum: number, sale: any) => sum + sale.totalAmount, 0)
    const todaySalesCount = todaySalesFiltered.length
    const avgTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0

    // Get top products (simplified)
    const productSales: Record<string, { nome: string; vendas: number; receita: number }> = {}
    todaySalesFiltered.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            nome: item.product?.name || 'Produto Desconhecido',
            vendas: 0,
            receita: 0
          }
        }
        productSales[item.productId].vendas += item.quantity
        productSales[item.productId].receita += item.quantity * item.unitPrice
      })
    })

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 3)
      .map(p => ({
        nome: p.nome,
        vendas: p.vendas,
        receita: `R$ ${p.receita.toFixed(2).replace('.', ',')}`
      }))

    // Get recent sales
    const recentSales = salesToday.slice(0, 5).map((sale: any) => ({
      id: sale.id,
      cliente: sale.customer?.name || 'Cliente',
      total: `R$ ${sale.totalAmount.toFixed(2).replace('.', ',')}`,
      data: new Date(sale.createdAt).toLocaleString('pt-BR')
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        lowStockProducts,
        outOfStockProducts,
        todayRevenue,
        todaySalesCount,
        avgTicket,
        topProducts,
        recentSales
      }
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}