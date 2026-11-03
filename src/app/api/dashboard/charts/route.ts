import { NextResponse } from "next/server"
import { getDashboardCharts } from "@/services/dashboardChartsService"
import { apiFailure } from "@/lib/apiResponse"

// GET /api/dashboard/charts — gráficos do Painel (35 dias, horário de pico,
// formas de pagamento e mais vendidos do mês, repor estoque)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getDashboardCharts() })
  } catch (error) {
    return apiFailure(error)
  }
}
