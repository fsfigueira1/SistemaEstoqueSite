import { NextResponse } from "next/server"
import { apagarCertificado, salvarCertificado } from "@/lib/nfce/localStore"
import { nfceError } from "@/lib/nfce/apiError"

const MAX = 64 * 1024

// POST /api/nfce/certificado — multipart { arquivo (.pfx/.p12), senha }.
// Fica só neste PC (pasta de dados do app), com a senha cifrada. Só o dono.
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("arquivo")
    const senha = String(form.get("senha") ?? "")
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "Escolha o arquivo do certificado" }, { status: 400 })
    if (file.size > MAX) return NextResponse.json({ success: false, error: "Arquivo grande demais para um certificado A1" }, { status: 400 })
    const info = salvarCertificado(Buffer.from(await file.arrayBuffer()), senha)
    return NextResponse.json({ success: true, data: info })
  } catch (error) {
    if (error instanceof Error && /certificado|senha|chave privada/i.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return nfceError(error)
  }
}

// DELETE /api/nfce/certificado — tira o certificado deste PC.
export async function DELETE() {
  try {
    apagarCertificado()
    return NextResponse.json({ success: true })
  } catch (error) {
    return nfceError(error)
  }
}
