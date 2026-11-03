import { NextResponse } from "next/server"
import { AuthService } from "@/services/authService"
import { requestRole } from "@/lib/requestRole"
import { apiFailure } from "@/lib/apiResponse"
import { isJsonRequest } from "@/lib/requireJson"

// Só o dono (o proxy já barra o balcão; a rota confere de novo).
async function ownerOnly() {
  return (await requestRole()) === "OWNER" ? null : NextResponse.json({ success: false, error: "Só o dono" }, { status: 403 })
}

// GET /api/auth/credentials — usuários atuais (sem senha)
export async function GET() {
  const deny = await ownerOnly()
  if (deny) return deny
  try {
    return NextResponse.json({ success: true, data: await AuthService.users() })
  } catch (error) {
    return apiFailure(error)
  }
}

// PUT /api/auth/credentials { role, user?, password?, ownerPassword } — troca usuário/senha
export async function PUT(request: Request) {
  const deny = await ownerOnly()
  if (deny) return deny
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const body = await request.json().catch(() => ({}))
  const role = body?.role === "OWNER" || body?.role === "EMPLOYEE" ? body.role : null
  if (!role) return NextResponse.json({ success: false, error: "Perfil inválido" }, { status: 400 })
  try {
    const data = await AuthService.change({
      role,
      user: typeof body.user === "string" && body.user.trim() ? body.user : undefined,
      password: typeof body.password === "string" && body.password ? body.password : undefined,
      ownerPassword: String(body.ownerPassword ?? ""),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg === "Senha do dono incorreta") return NextResponse.json({ success: false, error: msg }, { status: 403 })
    return apiFailure(error)
  }
}
