import { NextResponse } from "next/server"
import { getHistory } from "@/services/closingService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/reports/history?days=30 — resumo por dia + status da conferência
export async function GET(request: Request) {
  try {
    const days = Math.min(120, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30))
    const data = await getHistory(days)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
