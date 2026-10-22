import { NextResponse } from "next/server"
import { ContactService } from "@/services/contactService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// POST /api/contacts/import-customers — clientes do sistema com telefone viram contatos
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    return NextResponse.json({ success: true, data: await ContactService.importCustomers() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
