import { NextResponse } from "next/server"
import { CirandaPaymentService } from "@/services/cirandaPaymentService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/ciranda/:id — a foto do comprovante (data URL)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const image = await CirandaPaymentService.receipt((await params).id)
    if (!image) return NextResponse.json({ success: false, error: "Comprovante não encontrado" }, { status: 404 })
    return NextResponse.json({ success: true, data: image })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
