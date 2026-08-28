import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/services/cashSessionService"
import { prisma } from "@/lib/lib/prisma"

// GET /api/cash-session/current - Get current open cash session for the authenticated user
export async function GET() {
  try {
    // Find the first active cash register
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { isActive: true },
      select: { id: true }
    })

    if (!cashRegister) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Nenhum caixa ativo configurado.'
      })
    }

    const openSession = await CashSessionService.getOpenCashSession(cashRegister.id)

    if (!openSession) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Não existe uma sessão de caixa aberta.'
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: openSession.id,
        cashRegisterId: openSession.cashRegisterId,
        openedById: openSession.openedById,
        openedAt: openSession.openedAt,
        openingAmount: openSession.openingAmount,
        status: openSession.status
      }
    })
  } catch (error) {
    console.error('Cash session API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Erro ao buscar sessão de caixa',
          code: 'CASH_SESSION_FETCH_ERROR'
        }
      },
      { status: 500 }
    )
  }
}