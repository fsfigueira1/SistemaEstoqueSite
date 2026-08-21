import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale completion
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const {
      amount,
      method,
      transactionId,
      processingFee,
      installmentCount,
      changeAmount,
      processedById
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

    if (!processedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Processed by ID is required",
            code: "MISSING_PROCESSED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await SaleService.completeSale(params.id, {
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
    return handleApiError(error)
  }
}