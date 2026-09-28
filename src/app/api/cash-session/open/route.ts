import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"
import { prisma } from "@/lib/prisma"
import { getSystemUserId } from "@/lib/systemUser"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/cash-session/open - Get available cash registers for opening
export async function GET() {
  try {
    // Get all active cash registers
    const select = { id: true, name: true, description: true }
    let cashRegisters = await prisma.cashRegister.findMany({
      where: { isActive: true },
      select,
      orderBy: { createdAt: 'asc' },
    });

    // If no cash registers exist, create a default one — com trava, para 3 PCs
    // abrindo pela primeira vez não criarem 3 "Caixa Principal".
    if (cashRegisters.length === 0) {
      cashRegisters = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cash-register-default'))`
        const again = await tx.cashRegister.findMany({ where: { isActive: true }, select, orderBy: { createdAt: 'asc' } })
        if (again.length) return again
        const created = await tx.cashRegister.create({
          data: { name: 'Caixa Principal', description: 'Caixa padrão do sistema', isActive: true },
          select,
        })
        return [created]
      })
    }

    return NextResponse.json({
      success: true,
      data: cashRegisters
    });
  } catch (error) {
    console.error("Cash session open API error:", error);
    return NextResponse.json(
      { error: friendlyError(error).message },
      { status: 500 }
    );
  }
}

// POST /api/cash-session/open - Open a new cash session
export async function POST(request: Request) {
  try {
    // Get system user ID (fixed for desktop app)
    const userId = await getSystemUserId()

    const body = await request.json()
    const { cashRegisterId, openingAmount, reuseIfOpen } = body

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

    // PDV: só precisa de uma sessão aberta — se outro PC abriu antes, usa a dele
    if (existingOpenSession && reuseIfOpen) {
      return NextResponse.json({ success: true, data: { id: existingOpenSession.id, cashRegisterId: existingOpenSession.cashRegisterId, status: existingOpenSession.status } }, { status: 200 })
    }

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
    let openSession
    try {
      openSession = await CashSessionService.openCashSession({
        cashRegisterId,
        openedById: userId,
        openingAmount: Number(openingAmount)
      })
    } catch (err) {
      // outro PC abriu no mesmo instante
      const other = reuseIfOpen ? await CashSessionService.getOpenCashSession(cashRegisterId) : null
      if (!other) throw err
      return NextResponse.json({ success: true, data: { id: other.id, cashRegisterId: other.cashRegisterId, status: other.status } }, { status: 200 })
    }

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
    console.error("Cash session open API error:", error)
    return NextResponse.json(
      { error: friendlyError(error).message },
      { status: 500 }
    )
  }
}