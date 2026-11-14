import { NextResponse } from "next/server"
import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"

// POST /api/nfce/emitir — { saleId, cpf?, nome? }: emite a NFC-e da venda (balcão e dono).
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { saleId?: unknown; cpf?: unknown; nome?: unknown }
    const saleId = typeof body.saleId === "string" ? body.saleId : ""
    if (!saleId) return NextResponse.json({ success: false, error: "Informe a venda" }, { status: 400 })
    const data = await NfceService.emitirParaVenda(saleId, {
      consumidorDoc: typeof body.cpf === "string" ? body.cpf : undefined,
      consumidorNome: typeof body.nome === "string" ? body.nome : undefined,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return nfceError(error)
  }
}
