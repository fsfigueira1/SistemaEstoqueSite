import { NextResponse } from "next/server"
import { QuoteRequestService } from "@/services/quoteRequestService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/quote-requests/[id] — itens com o preço da época e o de agora
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const data = await QuoteRequestService.get((await params).id)
    if (!data) return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// PATCH /api/quote-requests/[id] { status } — aberto | separado | retirado | cancelado
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    await QuoteRequestService.setStatus((await params).id, String(body?.status ?? ""))
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 })
    }
    const invalid = /Situação inválida/.test(String((error as Error)?.message))
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: invalid ? 400 : 500 })
  }
}
