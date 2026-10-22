import { NextResponse } from "next/server"
import { CopilotService } from "@/services/copilotService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// A NVIDIA gratuita pode levar perto de 1 minuto
export const maxDuration = 120

// POST /api/copilot { name, phone, text } — resposta pronta para o atendente
// conferir e enviar no WhatsApp (o sistema nunca envia sozinho). Orçamento
// montado vira um registro em Orçamentos pedidos.
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  const text = String(body?.text ?? "").trim()
  const name = String(body?.name ?? "").trim()
  if (!text) return NextResponse.json({ success: false, error: "Cole a mensagem do cliente" }, { status: 400 })
  if (text.length > 8000) return NextResponse.json({ success: false, error: "Mensagem grande demais" }, { status: 400 })
  if (name.length > 120) return NextResponse.json({ success: false, error: "Nome grande demais" }, { status: 400 })
  try {
    const data = await CopilotService.draft({ name, phone: String(body?.phone ?? ""), text })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
