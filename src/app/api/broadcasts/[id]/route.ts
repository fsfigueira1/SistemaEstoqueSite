import { NextResponse } from "next/server"
import { BroadcastService } from "@/services/broadcastService"
import { friendlyError } from "@/lib/friendlyError"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/broadcasts/[id] — mensagem pronta e destinatários (quem já recebeu)
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const data = await BroadcastService.get((await params).id)
    if (!data) return NextResponse.json({ success: false, error: "Envio não encontrado" }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
