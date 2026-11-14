import { NextResponse } from "next/server"
import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"

// POST /api/nfce/notas/[id]/consultar — pergunta à SEFAZ o resultado de uma nota que ficou sem resposta.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await NfceService.consultar((await params).id) })
  } catch (error) {
    return nfceError(error)
  }
}
