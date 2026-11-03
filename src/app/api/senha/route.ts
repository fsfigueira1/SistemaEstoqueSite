import { NextResponse } from "next/server"
import { AuthService, ROLE_LABEL } from "@/services/authService"
import { COOKIE, SESSION_MS, authSecret, signToken } from "@/lib/authToken"
import { homeFor } from "@/lib/access"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// Freio contra chute de senha: 5 erros seguidos do mesmo endereço → espera 2 minutos.
const FAILS = new Map<string, { n: number; until: number }>()
const MAX_FAILS = 5
const LOCK_MS = 2 * 60_000

const clientKey = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"

// POST /api/senha { user, password } — entra e recebe o crachá (cookie assinado)
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const key = clientKey(request)
  const f = FAILS.get(key)
  if (f && f.until > Date.now()) {
    const s = Math.ceil((f.until - Date.now()) / 1000)
    return NextResponse.json({ success: false, error: `Muitas tentativas. Tente de novo em ${s} segundos.` }, { status: 429 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const role = await AuthService.login(String(body?.user ?? ""), String(body?.password ?? ""))
    if (!role) {
      // depois de uma espera, a contagem recomeça
      const n = (f && f.until === 0 ? f.n : 0) + 1
      FAILS.set(key, n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 })
      return NextResponse.json({ success: false, error: "Usuário ou senha incorretos" }, { status: 401 })
    }
    FAILS.delete(key)
    const token = await signToken(await authSecret(), role, Date.now() + SESSION_MS)
    const res = NextResponse.json({ success: true, data: { role, label: ROLE_LABEL[role], home: homeFor(role) } })
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.url.startsWith("https:"),
      maxAge: SESSION_MS / 1000,
      path: "/",
    })
    return res
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
