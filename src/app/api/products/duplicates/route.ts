import { NextResponse } from "next/server"
import { listDuplicates, mergeProducts } from "@/services/duplicateService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/products/duplicates — grupos de produtos parecidos
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await listDuplicates() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}

// POST /api/products/duplicates { keepId, removeIds } — junta os produtos
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const removeIds = Array.isArray(body?.removeIds) ? body.removeIds.map(String) : []
    const data = await mergeProducts(String(body?.keepId ?? ""), removeIds)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 400 })
  }
}
