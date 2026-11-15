import { NfceService } from "@/services/nfceService"
import { nfceError } from "@/lib/nfce/apiError"

// GET /api/nfce/notas/[id]/danfe?w=80mm|58mm&via=... — página do DANFE NFC-e pronta para a térmica.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url)
    const width = url.searchParams.get("w") === "58mm" ? "58mm" : "80mm"
    const via = url.searchParams.get("via") ?? undefined
    const html = await NfceService.danfe((await params).id, width, via)
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
  } catch (error) {
    return nfceError(error)
  }
}
