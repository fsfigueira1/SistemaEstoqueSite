import { NextResponse } from "next/server"
import { QuoteRequestService, type QuoteItem } from "@/services/quoteRequestService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// GET /api/quote-requests?q=&status= — orçamentos pedidos (busca por nome/telefone)
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams
    const data = await QuoteRequestService.list({ q: p.get("q") ?? undefined, status: p.get("status") ?? undefined })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// POST /api/quote-requests { name, phone, title, items, toConfirm, total, message } — salvo pelo balcão (Lista Escolar)
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    const name = String(body?.name ?? "").trim()
    if (!name) return NextResponse.json({ success: false, error: "Informe o nome do cliente" }, { status: 400 })
    const items: QuoteItem[] = (Array.isArray(body?.items) ? body.items : []).slice(0, 300).map((i: Record<string, unknown>) => ({
      qty: Math.max(1, Math.round(num(i?.qty)) || 1),
      text: String(i?.text ?? "").slice(0, 200),
      productId: typeof i?.productId === "string" ? i.productId : null,
      price: i?.price == null ? null : num(i.price),
      take: Math.max(0, Math.round(num(i?.take))),
    }))
    if (!items.length) return NextResponse.json({ success: false, error: "O orçamento está vazio" }, { status: 400 })
    const data = await QuoteRequestService.create({
      name,
      phone: body?.phone ? String(body.phone) : null,
      source: "balcao",
      title: String(body?.title ?? ""),
      items,
      toConfirm: (Array.isArray(body?.toConfirm) ? body.toConfirm : []).slice(0, 300).map(String),
      total: num(body?.total),
      message: String(body?.message ?? ""),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
