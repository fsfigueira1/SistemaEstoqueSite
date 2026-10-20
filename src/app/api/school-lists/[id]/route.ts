import { NextResponse } from "next/server"
import { SavedListService } from "@/services/savedListService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/school-lists/[id] — orçamento da lista salva (id ou código "L-XXXX"), com preço de agora
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const quote = await SavedListService.getQuote((await params).id)
    if (!quote) return NextResponse.json({ success: false, error: "Lista não encontrada" }, { status: 404 })
    return NextResponse.json({ success: true, data: quote })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// PATCH /api/school-lists/[id] { active } — ativa/desativa (desativada some do robô e do site)
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isJsonRequest(request)) {
    return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.active !== "boolean") {
      return NextResponse.json({ success: false, error: "Informe active" }, { status: 400 })
    }
    await SavedListService.setActive((await params).id, body.active)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// DELETE /api/school-lists/[id]
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await SavedListService.remove((await params).id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
