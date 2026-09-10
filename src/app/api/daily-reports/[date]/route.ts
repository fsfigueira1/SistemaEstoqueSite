import { NextResponse } from "next/server"
import { DailyReportService } from "@/services/dailyReportService"

// GET /api/daily-reports/[date] - relatório de um dia civil BRT ("YYYY-MM-DD").
export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  try {
    const { date } = await params
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida (use YYYY-MM-DD)" }, { status: 400 })
    }

    const report = await DailyReportService.getByDate(date)
    if (!report) {
      return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
