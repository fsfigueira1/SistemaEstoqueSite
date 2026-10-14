import { NextResponse } from "next/server"
import { LabelService } from "@/services/labelService"
import { friendlyError } from "@/lib/friendlyError"

// PUT /api/labels/promo { productId, compareAtPrice (null = sem promoção), promoUntil "AAAA-MM-DD" | null }
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const productId = String(body?.productId ?? "")
    if (!productId) return NextResponse.json({ success: false, error: "productId obrigatório" }, { status: 400 })
    const raw = body?.compareAtPrice
    const compareAt = raw === null || raw === "" || raw === undefined ? null : Number(raw)
    if (compareAt !== null && !Number.isFinite(compareAt)) {
      return NextResponse.json({ success: false, error: "Preço da promoção inválido" }, { status: 400 })
    }
    await LabelService.setPromo(productId, compareAt, body?.promoUntil ? String(body.promoUntil) : null)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 400 })
  }
}
