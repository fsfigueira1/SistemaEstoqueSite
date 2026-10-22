import { NextResponse } from "next/server"
import { BroadcastService } from "@/services/broadcastService"
import { friendlyError } from "@/lib/friendlyError"
import { buildVcf } from "@/lib/contacts"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/broadcasts/[id]/vcf — contatos do envio (sem quem saiu) para importar
// no celular e montar a lista de transmissão do WhatsApp Business
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const b = await BroadcastService.get((await params).id)
    if (!b) return NextResponse.json({ success: false, error: "Envio não encontrado" }, { status: 404 })
    const vcf = buildVcf(b.recipients.filter((r) => !r.saiu))
    return new Response(vcf, {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": 'attachment; filename="contatos-lacolaria.vcf"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
