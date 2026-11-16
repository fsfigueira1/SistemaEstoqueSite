import { NextResponse } from "next/server"
import { aplicarNcm, limparEntrada, previaNcm } from "@/services/ncmImportService"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/products/ncm — NCM dos produtos pelas notas de compra (só o dono).
//   { itens }          → prévia: produto do cadastro x NCM da nota
//   { aplicar: [...] } → grava { productId, ncm, cest? } escolhidos na prévia
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { itens?: unknown; aplicar?: unknown }
    if (body.aplicar !== undefined) {
      return NextResponse.json({ success: true, data: await aplicarNcm(body.aplicar) })
    }
    const itens = limparEntrada(body.itens)
    if (!itens.length) {
      return NextResponse.json(
        { success: false, error: "Nenhum item com código de barras e NCM nas notas escolhidas" },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: true, data: await previaNcm(itens) })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 400 })
  }
}
