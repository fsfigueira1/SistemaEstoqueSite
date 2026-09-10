import { NextResponse } from "next/server"
import { DailyReportService } from "@/services/dailyReportService"

// GET /api/daily-reports - os relatórios diários mais recentes (até 90).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitRaw = parseInt(searchParams.get("limit") || "90", 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 365) : 90

    const reports = await DailyReportService.list(limit)
    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
