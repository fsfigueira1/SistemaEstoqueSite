import { NextResponse } from "next/server"
import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"
import { requestRole } from "@/lib/requestRole"

// POST /api/nfce/notas/[id]/cancelar — { justificativa } (mín. 15 letras). Só o dono.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if ((await requestRole()) !== "OWNER") {
      return NextResponse.json({ success: false, error: "Só o dono pode cancelar nota fiscal" }, { status: 403 })
    }
    const body = (await request.json()) as { justificativa?: unknown }
    const data = await NfceService.cancelar((await params).id, String(body.justificativa ?? ""))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return nfceError(error)
  }
}
