import { NextResponse } from "next/server"
import { WinbackService } from "@/services/winbackService"
import { friendlyError } from "@/lib/friendlyError"
import { requestRole } from "@/lib/requestRole"

// GET /api/agent/winback — quadro "Chamando de volta"
export async function GET() {
  try {
    const data = await WinbackService.board()
    // quanto cada cliente comprou é faturamento: só o dono vê o valor
    if ((await requestRole()) !== "OWNER") return NextResponse.json({ success: true, data: { ...data, cards: data.cards.map((c) => ({ ...c, bought: 0 })) } })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
