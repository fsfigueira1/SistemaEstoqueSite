import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/services/cashSessionService"
import { prisma } from "@/lib/lib/prisma"
import { getSystemUserId } from "@/lib/lib/systemUser"

// POST /api/cash-session/open - Open a new cash session
export async function POST(request: Request) {
  try {
    // Get system user ID (fixed for desktop app)
    const userId = await getSystemUserId()

    const body = await request.json()
    const { cashRegisterId, openingAmount } = body

    // Validate required fields
    if (!cashRegisterId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'ID do caixa é obrigatório',
            code: 'MISSING_CASH_REGISTER_ID'
          }
        },
        { status: 400 }
      )
    }

    if (openingAmount === undefined || openingAmount === null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Valor de abertura é obrigatório',
            code: 'MISSING_OPENING_AMOUNT'
          }
        },
        { status: 400 }
      )
    }

    // Verify cash register exists and is active
    const cashRegister = await prisma.cashRegister.findUnique({
      where: { id: cashRegisterId }
    })

    if (!cashRegister) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Caixa não encontrado',
            code: 'CASH_REGISTER_NOT_FOUND'
          }
        },
        { status: 404 }
      )
    }

    if (!cashRegister.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Não é possível abrir sessão para caixa inativo',
            code: 'CASH_REGISTER_INACTIVE'
          }
        },
        { status: 400 }
      )
    }

    // Check if there's already an open session for this cash register
    const existingOpenSession = await CashSessionService.getOpenCashSession(cashRegisterId)

    if (existingOpenSession) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Este caixa já possui uma sessão aberta',
            code: 'SESSION_ALREADY_OPEN'
          }
        },
        { status: 400 }
      )
    }

    // Open the cash session
    const openSession = await CashSessionService.openCashSession({
      cashRegisterId,
      openedById: userId,
      openingAmount: Number(openingAmount)
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: openSession.id,
          cashRegisterId: openSession.cashRegisterId,
          openedById: openSession.openedById,
          openedAt: openSession.openedAt,
          openingAmount: openSession.openingAmount,
          status: openSession.status
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Open cash session API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Erro ao abrir sessão de caixa',
          code: 'CASH_SESSION_OPEN_ERROR'
        }
      },
      { status: 500 }
    )
  }
}

// GET /api/cash-session/open - Get available cash registers for opening
export async function GET() {
  try {
    // Get all active cash registers
    const cashRegisters = await prisma.cashRegister.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true
      }
    })

    return NextResponse.json({
      success: true,
      data: cashRegisters
    })
  } catch (error) {
    console.error('Get cash registers API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Erro ao buscar caixas disponíveis',
          code: 'CASH_REGISTERS_FETCH_ERROR'
        }
      },
      { status: 500 }
    )
  }
}