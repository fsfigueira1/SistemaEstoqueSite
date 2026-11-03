import { NextResponse } from "next/server"
import { AuthService, ROLE_LABEL, normUser } from "@/services/authService"
import { COOKIE, SESSION_MS, signToken } from "@/lib/authToken"
import { sessionKey } from "@/lib/authStamp"
import { homeFor } from "@/lib/access"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

// Freio contra chute de senha: 5 erros seguidos → espera 2 minutos. Conta por
// usuário (não depende do endereço, que o navegador pode inventar) e também
// por endereço. A tentativa é contada ANTES de conferir a senha, para várias
// tentativas ao mesmo tempo não passarem juntas.
const FAILS = new Map<string, { n: number; until: number }>()
const MAX_FAILS = 5
const LOCK_MS = 2 * 60_000
const MAX_KEYS = 2000

const keysFor = (request: Request, user: string) => [
  `u:${normUser(user)}`,
  `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`,
]

/** Segundos de espera se algum dos contadores está travado; 0 = pode tentar. */
function lockedFor(keys: string[], now: number): number {
  let wait = 0
  for (const k of keys) {
    const f = FAILS.get(k)
    if (f && f.until > now) wait = Math.max(wait, Math.ceil((f.until - now) / 1000))
  }
  return wait
}

function countAttempt(keys: string[], now: number) {
  if (FAILS.size > MAX_KEYS) FAILS.clear() // não cresce sem limite
  for (const k of keys) {
    const f = FAILS.get(k)
    // depois de uma espera, a contagem recomeça
    const n = (f && f.until <= now && f.until !== 0 ? 0 : (f?.n ?? 0)) + 1
    FAILS.set(k, n >= MAX_FAILS ? { n: 0, until: now + LOCK_MS } : { n, until: 0 })
  }
}

// POST /api/senha { user, password } — entra e recebe o crachá (cookie assinado)
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    const user = String(body?.user ?? "")
    const keys = keysFor(request, user)
    const now = Date.now()
    const wait = lockedFor(keys, now)
    if (wait) return NextResponse.json({ success: false, error: `Muitas tentativas. Tente de novo em ${wait} segundos.` }, { status: 429 })
    countAttempt(keys, now)
    const role = await AuthService.login(user, String(body?.password ?? ""))
    if (!role) return NextResponse.json({ success: false, error: "Usuário ou senha incorretos" }, { status: 401 })
    for (const k of keys) FAILS.delete(k)
    const token = await signToken(await sessionKey(role), role, Date.now() + SESSION_MS)
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
