// Resposta de erro das rotas da NFC-e: erro de negócio (NfceErro) vai com a
// mensagem como está; o resto passa pelo friendlyError.
import { NextResponse } from "next/server"
import { friendlyError } from "@/lib/friendlyError"
import { NfceErro } from "@/services/nfceService"

export function nfceError(error: unknown) {
  if (error instanceof NfceErro) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
}
