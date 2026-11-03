import { NextResponse } from "next/server"
import { AgentEventService, type AgentEventStatus } from "@/services/agentEventService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

type Ctx = { params: Promise<{ id: string }> }
const STATUSES: AgentEventStatus[] = ["enviada", "falhou", "cancelada"]

// POST /api/agent/events/[id] { status } — o robô conta se a mensagem saiu
export async function POST(request: Request, { params }: Ctx) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  const status = String(body?.status ?? "") as AgentEventStatus
  if (!STATUSES.includes(status)) return NextResponse.json({ success: false, error: "Situação inválida" }, { status: 400 })
  try {
    return NextResponse.json({ success: true, data: { updated: await AgentEventService.mark((await params).id, status) } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
