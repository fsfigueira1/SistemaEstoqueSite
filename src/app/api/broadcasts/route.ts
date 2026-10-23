import { NextResponse } from "next/server"
import { BroadcastService } from "@/services/broadcastService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// GET /api/broadcasts — histórico de novidades
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await BroadcastService.list() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/broadcasts { text } — cria o envio para quem recebe novidades agora
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  try {
    return NextResponse.json({ success: true, data: await BroadcastService.create(String(body?.text ?? "")) })
  } catch (error) {
    const message = friendlyError(error).message
    const validation = /Escreva a mensagem|Nenhum contato/.test(String((error as Error)?.message))
    return NextResponse.json({ success: false, error: message }, { status: validation ? 400 : 500 })
  }
}
