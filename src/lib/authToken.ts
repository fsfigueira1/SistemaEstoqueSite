// "Crachá" do login (cookie erp_auth): perfil + validade + assinatura.
// Formato: v1.<perfil>.<expira em ms>.<assinatura base64url>
// A assinatura é HMAC-SHA256 com o segredo do servidor — sem ele não dá para
// forjar um crachá (antes qualquer valor no cookie passava). Usa Web Crypto
// para rodar no proxy e nas rotas. A mesma conta existe em
// electron/authToken.cjs (o robô do WhatsApp se identifica assim).
// Testado em src/lib/authToken.test.ts.

export type Role = "OWNER" | "EMPLOYEE" | "ROBOT"
export const ROLES: Role[] = ["OWNER", "EMPLOYEE", "ROBOT"]
export const COOKIE = "erp_auth"
/** sessão "deslizante": cada uso renova; vence depois de tanto tempo parado */
export const SESSION_MS = 10 * 60 * 60 * 1000

const enc = new TextEncoder()

function b64url(bytes: ArrayBuffer): string {
  let s = ""
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256Hex(text: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(text))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Senha do banco dentro do endereço (postgresql://usuario:SENHA@host/...). */
export function dbPassword(url: string | undefined): string {
  try {
    return decodeURIComponent(new URL(url ?? "").password)
  } catch {
    return ""
  }
}

/**
 * Segredo: AUTH_SECRET (o aplicativo do balcão gera um aleatório de 64
 * caracteres e guarda na configuração dele). Sem ele, derivado do endereço do
 * banco — que só vale se tiver a senha do banco dentro (quem a conhece já
 * tem o banco inteiro). Sem nenhum dos dois, NÃO inventa um segredo fixo
 * (qualquer um forjaria um crachá de dono): falha e ninguém entra.
 */
export async function authSecret(env: Record<string, string | undefined> = process.env): Promise<string> {
  const s = (env.AUTH_SECRET ?? "").trim()
  if (s.length >= 32) return s
  if (dbPassword(env.DATABASE_URL).length >= 8) return sha256Hex(`lacolaria-auth|${env.DATABASE_URL}`)
  throw new Error("Segredo do login não configurado (AUTH_SECRET)")
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)))
}

/** Comparação sem atalho (não revela pelo tempo quantas letras bateram). */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export async function signToken(secret: string, role: Role, expiresAt: number): Promise<string> {
  const body = `v1.${role}.${Math.floor(expiresAt)}`
  return `${body}.${await hmac(secret, body)}`
}

/** Crachá válido e dentro da validade → perfil; senão null. */
export async function verifyToken(secret: string, token: string | undefined | null, now = Date.now()): Promise<{ role: Role; expiresAt: number } | null> {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 4 || parts[0] !== "v1") return null
  const [, role, exp, sig] = parts
  if (!ROLES.includes(role as Role)) return null
  const expiresAt = Number(exp)
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null
  if (!same(sig, await hmac(secret, `v1.${role}.${exp}`))) return null
  return { role: role as Role, expiresAt }
}
