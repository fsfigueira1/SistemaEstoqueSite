import { NextResponse } from "next/server"
import { AgentDashboardService } from "@/services/agentDashboardService"
import { friendlyError } from "@/lib/friendlyError"
import { requestRole } from "@/lib/requestRole"

// GET /api/agent/today — painel "IA hoje" e as últimas conversas do agente
export async function GET() {
  try {
    const data = await AgentDashboardService.today()
    // faturamento é só do dono: o balcão vê o que a IA fez, sem as vendas
    if ((await requestRole()) !== "OWNER") return NextResponse.json({ success: true, data: { ...data, sales: null } })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
