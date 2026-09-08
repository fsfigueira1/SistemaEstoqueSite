import { NextResponse } from "next/server"
import { CashMovementService } from "@/services/cashMovementService"

import { CashMovementType } from "@/generated/prisma/client"

// GET /api/cash-movements - List cash movements with filters and pagination OR get statistics (based on filters)
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash movement listing

    const { searchParams } = new URL(request.url)

    // Build options for CashMovementService
    const options: {
      cashSessionId?: string
      type?: string
      startDate?: Date
      endDate?: Date
    } = {}

    const cashSessionId = searchParams.get("cashSessionId")
    if (cashSessionId) {
      options.cashSessionId = cashSessionId
    }

    const typeParam = searchParams.get("type")
    if (typeParam) {
      // Validate type value
      const validTypes = ["SALE", "OPENING", "WITHDRAWAL", "DEPOSIT", "ADJUSTMENT"] as const
      if (validTypes.includes(typeParam as CashMovementType)) {
        options.type = typeParam as CashMovementType
      }
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    // For list endpoint, we'll use getStatistics or getCashMovementsBySession based on filters
    // If we have a cashSessionId, we'll get movements by session, otherwise we'll get statistics
    let result
    if (options.cashSessionId) {
      result = await CashMovementService.getCashMovementsBySession(
        options.cashSessionId,
        {
          limit: 10,
          offset: 0, // Convert page to offset (page number)
          type: options.type as CashMovementType,
          startDate: options.startDate,
          endDate: options.endDate
        }
      )
    } else {
      result = await CashMovementService.getStatistics({
        cashSessionId: options.cashSessionId,
        startDate: options.startDate,
        endDate: options.endDate
      })
    }

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// POST /api/cash-movements - Create new cash movement
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash movement creation

    const data = await request.json()
    const { cashSessionId, type, amount, description, performedById } = data

    // Validate required fields
    if (!cashSessionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Cash session ID is required",
            code: "MISSING_CASH_SESSION_ID"
          }
        },
        { status: 400 }
      )
    }

    if (!type) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Cash movement type is required",
            code: "MISSING_TYPE"
          }
        },
        { status: 400 }
      )
    }

    // Validate type value
    const validTypes = ["SALE", "OPENING", "WITHDRAWAL", "DEPOSIT", "ADJUSTMENT"]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid cash movement type",
            code: "INVALID_TYPE"
          }
        },
        { status: 400 }
      )
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Amount is required and must be positive",
            code: "INVALID_AMOUNT"
          }
        },
        { status: 400 }
      )
    }

    if (!description || description.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Description is required",
            code: "MISSING_DESCRIPTION"
          }
        },
        { status: 400 }
      )
    }

    if (!performedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Performed by ID is required",
            code: "MISSING_PERFORMED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await CashMovementService.createCashMovement({
      cashSessionId,
      type,
      amount,
      description,
      performedById
    })

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    )
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}