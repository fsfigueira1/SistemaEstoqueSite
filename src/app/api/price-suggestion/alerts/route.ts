import { NextResponse } from "next/server"
import { getPriceAlerts } from "@/services/priceAdvisorService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/price-suggestion/alerts — produtos abaixo do preço de mercado
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getPriceAlerts() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
