import { NextResponse } from "next/server"
import { dateKey, getDailyReport, isDateKey } from "@/services/reportService"
import { saveClosing } from "@/services/closingService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/reports/daily?date=AAAA-MM-DD — relatório do dia (padrão: hoje)
export async function GET(request: Request) {
  try {
    const param = new URL(request.url).searchParams.get("date")
    const key = isDateKey(param) ? param : dateKey(new Date())
    const report = await getDailyReport(key)
    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}

// PUT /api/reports/daily — grava a conferência do caixa do dia
// body: { date, cashFloat, withdrawals, countedCash, countedCard, countedPix, notes }
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!isDateKey(body?.date)) {
      return NextResponse.json({ success: false, error: { message: "Data inválida", code: "VALIDATION_ERROR" } }, { status: 400 })
    }
    const closing = await saveClosing(body.date, body)
    return NextResponse.json({ success: true, data: closing })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
