import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"
import { requestRole } from "@/lib/requestRole"

// GET /api/nfce/notas/[id]/xml — baixa o XML (nfeProc) para o contador. Só o dono.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if ((await requestRole()) !== "OWNER") {
      return Response.json({ success: false, error: "Só o dono baixa o XML" }, { status: 403 })
    }
    const { nome, xml } = await NfceService.xml((await params).id)
    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
    })
  } catch (error) {
    return nfceError(error)
  }
}
