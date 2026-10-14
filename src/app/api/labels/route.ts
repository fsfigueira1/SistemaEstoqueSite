import { NextResponse } from "next/server"
import { LabelService } from "@/services/labelService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/labels?ids=a,b — situação da etiqueta (promoção, precisa reimprimir)
export async function GET(request: Request) {
  try {
    const ids = new URL(request.url).searchParams.get("ids")
    const list = ids ? ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined
    return NextResponse.json({ success: true, data: await LabelService.getInfo(list) })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
