import { NextResponse } from "next/server"
import { SavedListService } from "@/services/savedListService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// GET /api/school-lists — listas escolares salvas (resumo)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await SavedListService.listSaved() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/school-lists { schoolName, grade, schoolYear, sourceText, items } — salva (ou substitui) a lista
export async function POST(request: Request) {
  if (!isJsonRequest(request)) {
    return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  }
  const body = await request.json().catch(() => ({}))
  try {
    return NextResponse.json({ success: true, data: await SavedListService.saveList(body) })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 400 })
  }
}
