import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/sales/[id]/refund — estorna uma venda concluída
// (devolve o estoque, marca o pagamento como REFUNDED e registra saída no caixa)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await SaleService.refundSale(id)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { error: friendlyError(error).message },
      { status: 500 },
    )
  }
}
