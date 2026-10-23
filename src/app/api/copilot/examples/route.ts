import { NextResponse } from "next/server"
import { CopilotExampleService } from "@/services/copilotExampleService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// GET /api/copilot/examples — o que a IA aprendeu (respostas aprovadas)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await CopilotExampleService.list() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/copilot/examples { customerText, aiReply, finalReply } — resposta aprovada pelo atendente
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    const finalReply = String(body?.finalReply ?? "")
    if (finalReply.length > 8000) return NextResponse.json({ success: false, error: "Resposta grande demais" }, { status: 400 })
    await CopilotExampleService.record({
      customerText: String(body?.customerText ?? ""),
      aiReply: String(body?.aiReply ?? ""),
      finalReply,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
