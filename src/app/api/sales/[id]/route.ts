import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"



// GET /api/sales/[id] - Get sale by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale retrieval


    const result = await SaleService.getSale((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 }); }
}

// PUT /api/sales/[id] - NOT IMPLEMENTED: SaleService doesn't have update method
// Only note updates might be possible via direct Prisma update, but service layer doesn't expose this
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale modification


    // SaleService doesn't expose an update method, so we return method not allowed
    // Following the requirement to not implement methods that don't exist in service
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Method not allowed - Sale update not supported via API",
          code: "METHOD_NOT_ALLOWED"
        }
      },
      { status: 405 }
    )
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 }); }
}

// DELETE /api/sales/[id]
//   ?hard=1            -> apaga a venda de vez (itens, pagamentos, movimentações)
//   ?hard=1&restock=1  -> e devolve as quantidades ao estoque
//   (sem ?hard)        -> comportamento antigo: cancela (só venda PENDENTE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    if (url.searchParams.get("hard") === "1") {
      const result = await SaleService.deleteSale(id, {
        restock: url.searchParams.get("restock") === "1",
      })
      return NextResponse.json({ success: true, data: result })
    }
    const result = await SaleService.cancelSale(id)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Erro ao excluir a venda" } },
      { status: 500 },
    )
  }
}