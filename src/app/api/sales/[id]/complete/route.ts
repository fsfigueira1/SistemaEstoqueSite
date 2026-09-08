import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { getSystemUserId } from "@/lib/systemUser"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale completion
    const data = await request.json()
    const {
      amount,
      method,
      transactionId,
      processingFee,
      installmentCount,
      changeAmount
    } = data

    // Validate required fields
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Payment amount must be positive",
            code: "INVALID_AMOUNT"
          }
        },
        { status: 400 }
      )
    }

    const processedById = await getSystemUserId()
    const result = await SaleService.completeSale((await params).id, {
      amount,
      method,
      transactionId,
      processingFee,
      installmentCount,
      changeAmount,
      processedById
    })

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}