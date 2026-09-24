import { NextResponse } from "next/server"
import { getLatestAdvice, suggestPrice } from "@/services/priceAdvisorService"
import { friendlyError } from "@/lib/friendlyError"

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null)

// POST /api/price-suggestion — pesquisa o mercado e sugere preço
// body: { barcode?, name?, productId?, costPrice?, currentPrice?, force? }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const advice = await suggestPrice({
      barcode: str(body.barcode),
      name: str(body.name),
      productId: str(body.productId),
      costPrice: num(body.costPrice),
      currentPrice: num(body.currentPrice),
      force: body.force === true,
    })
    return NextResponse.json({ success: true, data: advice })
  } catch (error) {
    const e = friendlyError(error)
    const status = e.message === "IA não configurada" ? 412 : e.message === "Falta preencher um campo" ? 400 : 502
    return NextResponse.json({ success: false, error: e }, { status })
  }
}

// GET /api/price-suggestion?productId=…|barcode=…|name=… — última pesquisa salva (não gasta crédito)
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    const advice = await getLatestAdvice({
      productId: str(q.get("productId")),
      barcode: str(q.get("barcode")),
      name: str(q.get("name")),
      currentPrice: num(q.get("currentPrice")),
      costPrice: num(q.get("costPrice")),
    })
    return NextResponse.json({ success: true, data: advice })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
