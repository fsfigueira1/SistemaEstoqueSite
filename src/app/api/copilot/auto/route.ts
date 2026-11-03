import { NextResponse } from "next/server"
import { AutoReplyService } from "@/services/autoReplyService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// A NVIDIA gratuita pode levar perto de 1 minuto
export const maxDuration = 120

// GET /api/copilot/auto — a resposta automática está ligada? estamos no horário?
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await AutoReplyService.status() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/copilot/auto { name, phone, text, history? } — usado pelo robô do aplicativo:
// responde "send" (com o texto), "human" (passa para o atendente), "wait"
// (fora do horário) ou "off" (desligada).
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  const text = String(body?.text ?? "").trim()
  const name = String(body?.name ?? "").trim().slice(0, 120)
  const phone = String(body?.phone ?? "").replace(/\D/g, "").slice(0, 15)
  if (!text) return NextResponse.json({ success: false, error: "Mensagem vazia" }, { status: 400 })
  if (text.length > 8000) return NextResponse.json({ success: false, error: "Mensagem grande demais" }, { status: 400 })
  try {
    // conversa recente (o robô lê do WhatsApp): o agente responde com contexto
    const history = Array.isArray(body?.history)
      ? (body.history as unknown[])
          .slice(-20)
          .map((m) => m as { from?: unknown; text?: unknown })
          .filter((m) => (m.from === "cliente" || m.from === "loja") && typeof m.text === "string" && m.text.trim())
          .map((m) => ({ from: m.from as "cliente" | "loja", text: String(m.text).slice(0, 2000) }))
      : undefined
    return NextResponse.json({ success: true, data: await AutoReplyService.decide({ name, phone, text, history }) })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
