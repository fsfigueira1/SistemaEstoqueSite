import { NextResponse } from "next/server"
import { getMonthlyReport, isMonthKey } from "@/services/monthlyReportService"
import { apiFailure } from "@/lib/apiResponse"

// GET /api/reports/monthly?month=AAAA-MM — relatório do mês, com os ajustes
// de estoque (motivo + explicação de cada saída)
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month")
  if (!isMonthKey(month)) return NextResponse.json({ success: false, error: { message: "Mês inválido (use AAAA-MM)", code: "VALIDATION_ERROR" } }, { status: 400 })
  try {
    return NextResponse.json({ success: true, data: await getMonthlyReport(month) })
  } catch (error) {
    return apiFailure(error)
  }
}
