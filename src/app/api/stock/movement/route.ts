import { NextResponse } from "next/server"
import { StockService } from "@/services/stockService"


import { StockMovementType } from "@/generated/prisma/client"

// POST /api/stock/movement - Create stock movements (add/remove/adjust)
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for stock modification


    const data = await request.json()
    const { type, ...input } = data

    let result;

    // Handle different types of stock movements
    switch (type) {
      case "add":
        // Add stock
        result = await StockService.addStock(input);
        break;

      case "remove":
        // Remove stock
        result = await StockService.removeStock(input);
        break;

      case "adjust":
        // Adjust stock
        result = await StockService.adjustStock(input);
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              message: "Invalid movement type. Use 'add', 'remove', or 'adjust'",
              code: "INVALID_MOVEMENT_TYPE"
            }
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// GET /api/stock/movement - Get stock movements with filtering and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing stock movements


    const { searchParams } = new URL(request.url)

    // Get product ID if filtering by product
    const productId = searchParams.get("productId")

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Product ID is required for stock movements query",
            code: "MISSING_PRODUCT_ID"
          }
        },
        { status: 400 }
      );
    }

    // Build options object for StockService
    const options: {
      limit?: number;
      offset?: number;
      type?: StockMovementType;
      startDate?: Date;
      endDate?: Date;
    } = {};

    // Handle limit and offset (using limit as take, calculate offset from page)
    const limitParam = searchParams.get("limit")
    const pageParam = searchParams.get("page")

    if (limitParam !== null) {
      options.limit = parseInt(limitParam, 10)
    }

    if (pageParam !== null && limitParam !== null) {
      const page = parseInt(pageParam, 10)
      const limit = parseInt(limitParam, 10)
      options.offset = (page - 1) * limit
    } else if (pageParam !== null) {
      // Default limit if page is specified but limit is not
      options.offset = (parseInt(pageParam, 10) - 1) * 50 // default limit of 50
    }

    // Handle type filter
    const typeParam = searchParams.get("type")
    if (typeParam) {
      options.type = typeParam as StockMovementType
    }

    // Handle date filters
    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const result = await StockService.getStockMovements(productId, options)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}