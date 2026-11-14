import { NextResponse } from "next/server"
import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"

// GET /api/nfce/notas?saleId=... — { enabled, ambiente, notas } de uma venda;
// sem saleId, as últimas emitidas (lista).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const saleId = url.searchParams.get("saleId")
    const data = saleId
      ? await NfceService.painelDaVenda(saleId)
      : await NfceService.listar(Number(url.searchParams.get("limit") ?? 50))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return nfceError(error)
  }
}
