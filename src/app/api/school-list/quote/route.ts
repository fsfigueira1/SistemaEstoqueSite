import { NextResponse } from "next/server"
import { quoteFromText } from "@/services/schoolListService"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/school-list/quote { text } — casa cada item da lista com os produtos da loja
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const lines = await quoteFromText(String(body?.text ?? ""))
    return NextResponse.json({ success: true, data: { lines } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 400 })
  }
}
