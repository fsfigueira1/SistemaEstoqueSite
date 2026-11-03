import { NextResponse } from "next/server"
import { WinbackService } from "@/services/winbackService"
import { friendlyError } from "@/lib/friendlyError"

// A NVIDIA gratuita pode levar perto de 1 minuto por mensagem
export const maxDuration = 120

// POST /api/agent/winback/next — usado pelo robô do aplicativo: a próxima
// mensagem de "chamar de volta" (ou null: desligado, fora do horário, limite do dia)
export async function POST() {
  try {
    return NextResponse.json({ success: true, data: await WinbackService.next() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
