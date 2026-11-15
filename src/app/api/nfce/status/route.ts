import { NextResponse } from "next/server"
import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"

// GET /api/nfce/status — testa a comunicação com a SEFAZ-SP (107 = em operação).
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await NfceService.statusSefaz() })
  } catch (error) {
    return nfceError(error)
  }
}
