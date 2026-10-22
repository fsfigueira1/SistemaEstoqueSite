import { NextResponse } from "next/server"
import { ContactService } from "@/services/contactService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"
import { whatsappNumber } from "@/lib/restock"

// GET /api/contacts — contatos das novidades
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await ContactService.list() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/contacts { name, phone } — adiciona à mão (já recebe novidades)
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    const phone = whatsappNumber(String(body?.phone ?? ""))
    if (!phone) return NextResponse.json({ success: false, error: "Telefone inválido" }, { status: 400 })
    const data = await ContactService.importRows([{ name: String(body?.name ?? ""), phone }], "manual")
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
