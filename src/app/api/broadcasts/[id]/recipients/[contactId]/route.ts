import { NextResponse } from "next/server"
import { BroadcastService } from "@/services/broadcastService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

type Ctx = { params: Promise<{ id: string; contactId: string }> }

// PATCH /api/broadcasts/[id]/recipients/[contactId] { sent } — marca/desmarca enviado
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.sent !== "boolean") return NextResponse.json({ success: false, error: "Informe sent" }, { status: 400 })
    const { id, contactId } = await params
    await BroadcastService.markSent(id, contactId, body.sent)
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ success: false, error: "Destinatário não encontrado" }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
