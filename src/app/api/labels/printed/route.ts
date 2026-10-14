import { NextResponse } from "next/server"
import { LabelService } from "@/services/labelService"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/labels/printed { productIds } — guarda o preço que foi para a gôndola
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ids: string[] = Array.isArray(body?.productIds) ? body.productIds.map(String) : []
    return NextResponse.json({ success: true, data: { marked: await LabelService.markPrinted(ids) } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
