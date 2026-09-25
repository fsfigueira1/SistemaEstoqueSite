import { NextResponse } from "next/server"
import { readListWithClaude } from "@/services/schoolListService"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/school-list/read { image: "data:image/jpeg;base64,..." } — lê a foto com o Claude
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = await readListWithClaude(String(body?.image ?? ""))
    return NextResponse.json({ success: true, data: { text } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 400 })
  }
}
