import { NextResponse } from "next/server"
import { requestRole } from "@/lib/requestRole"
import { ROLE_LABEL } from "@/services/authService"
import { homeFor } from "@/lib/access"

// GET /api/me — quem está usando (o menu mostra só o que o perfil pode abrir)
export async function GET() {
  const role = await requestRole()
  return NextResponse.json({ success: true, data: { role, label: ROLE_LABEL[role], home: homeFor(role) } })
}
