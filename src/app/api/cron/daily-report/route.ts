import { NextResponse } from "next/server"
import { DailyReportService } from "@/services/dailyReportService"
import { brtDayString } from "@/lib/brtDay"

// POST /api/cron/daily-report
// Chamado pelo Vercel Cron às 22:00 UTC (= 19:00 horário de Brasília).
// Autenticado pelo header Authorization: Bearer $CRON_SECRET que a Vercel injeta.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const day = brtDayString(new Date())
    const report = await DailyReportService.generateForDate(day)
    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
