import { NextResponse } from "next/server"
import { LabelService } from "@/services/labelService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/labels/stale — produtos com preço diferente da etiqueta impressa
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await LabelService.getStale() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
