import { NextResponse } from "next/server"
import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"

// GET /api/nfce/config — configuração fiscal (sem o CSC) e o certificado deste PC.
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await NfceService.getConfig() })
  } catch (error) {
    return nfceError(error)
  }
}

// PUT /api/nfce/config — { config, csc? } (csc vazio = mantém o atual). Só o dono (src/lib/access.ts).
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { config?: unknown; csc?: unknown }
    const data = await NfceService.saveConfig(body.config ?? {}, typeof body.csc === "string" ? body.csc : undefined)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return nfceError(error)
  }
}
