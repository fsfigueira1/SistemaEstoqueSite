import { NextResponse } from "next/server"
import { AgentAlertService } from "@/services/agentAlertService"
import { apiFailure } from "@/lib/apiResponse"
import { isJsonRequest } from "@/lib/requireJson"

// POST /api/agent/handoff { name, phone?, reason } — o robô do aplicativo
// avisa que passou uma conversa para a loja sem chegar na IA (foto, áudio, grupo…)
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  const name = String(body?.name ?? "").trim()
  const reason = String(body?.reason ?? "").trim()
  if (!name || !reason) return NextResponse.json({ success: false, error: "Nome e motivo" }, { status: 400 })
  try {
    return NextResponse.json({ success: true, data: { id: await AgentAlertService.logHandoff({ name, phone: body?.phone, reason }) } })
  } catch (error) {
    return apiFailure(error)
  }
}
