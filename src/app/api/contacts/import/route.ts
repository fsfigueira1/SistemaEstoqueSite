import { NextResponse } from "next/server"
import { ContactService } from "@/services/contactService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"
import { parseContacts } from "@/lib/contacts"

const MAX_ROWS = 5000

// POST /api/contacts/import { text, commit? } — planilha colada do Excel ou CSV.
// Sem commit: prévia (válidos, inválidos, novos/existentes). Com commit: grava.
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    const { rows, invalid } = parseContacts(String(body?.text ?? "").slice(0, 1_000_000))
    if (!rows.length) {
      return NextResponse.json({ success: false, error: "Não achei telefones válidos na planilha" }, { status: 400 })
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ success: false, error: `Planilha grande demais (máx. ${MAX_ROWS} contatos por vez)` }, { status: 400 })
    }
    if (body?.commit === true) {
      return NextResponse.json({ success: true, data: await ContactService.importRows(rows, "planilha") })
    }
    const preview = await ContactService.previewImport(rows)
    return NextResponse.json({ success: true, data: { rows, invalid, ...preview } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
