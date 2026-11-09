import { NextResponse } from "next/server"
import { CirandaPaymentService } from "@/services/cirandaPaymentService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/ciranda — quem mandou comprovante e dados do Pix do Ciranda (só o dono: ver lib/access.ts)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await CirandaPaymentService.list() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
