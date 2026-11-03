import { NextResponse } from "next/server"
import { AgentAlertService } from "@/services/agentAlertService"
import { apiFailure } from "@/lib/apiResponse"
import { isJsonRequest } from "@/lib/requireJson"

// A sugestão da NVIDIA pode levar perto de 1 minuto
export const maxDuration = 90

// GET /api/agent/alerts — avisos da assistente (precisa de atendente / parou de responder)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await AgentAlertService.list() })
  } catch (error) {
    return apiFailure(error)
  }
}

// POST /api/agent/alerts { id, action: "seen" | "suggest" } — marcar visto ou pedir a mensagem sugerida
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  const id = typeof body?.id === "string" ? body.id : ""
  if (!id) return NextResponse.json({ success: false, error: "Aviso inválido" }, { status: 400 })
  try {
    if (body.action === "suggest") return NextResponse.json({ success: true, data: { text: await AgentAlertService.suggest(id) } })
    if (body.action === "seen") return NextResponse.json({ success: true, data: { updated: await AgentAlertService.markSeen(id) } })
    return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 })
  } catch (error) {
    return apiFailure(error)
  }
}
