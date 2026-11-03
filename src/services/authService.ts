// Login com usuário e senha: dono (vê tudo) e balcão (PDV, Vendas e
// Atendimento). Enquanto o dono não trocar em Configurações → Acesso, valem
// os usuários padrão abaixo e as senhas do ambiente (OWNER_PASSWORD /
// EMPLOYEE_PASSWORD — o aplicativo do balcão já passa as dele). Senha trocada
// fica só em hash (bcrypt) no banco. Testado em tests/authService.test.ts.
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getServerSettings, SETTINGS_ID } from "@/lib/serverSettings"
import type { Role } from "@/lib/authToken"
import { resetAuthStamps } from "@/lib/authStamp"

export const DEFAULT_USERS = { OWNER: "laçolaria", EMPLOYEE: "balcao" } as const
export const ROLE_LABEL: Record<Role, string> = { OWNER: "Dono", EMPLOYEE: "Balcão", ROBOT: "Robô do WhatsApp" }
const MIN_PASSWORD = 6

/** "Laçolaria", "lacolaria " e "LAÇOLARIA" são o mesmo usuário. */
export const normUser = (u: string) =>
  u
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()

type Profile = { role: "OWNER" | "EMPLOYEE"; user: string; hash: string; envPassword: string }

async function profiles(): Promise<Profile[]> {
  const s = await getServerSettings()
  return [
    { role: "OWNER", user: s.authOwnerUser || DEFAULT_USERS.OWNER, hash: s.authOwnerHash, envPassword: process.env.OWNER_PASSWORD ?? "" },
    { role: "EMPLOYEE", user: s.authEmployeeUser || DEFAULT_USERS.EMPLOYEE, hash: s.authEmployeeHash, envPassword: process.env.EMPLOYEE_PASSWORD ?? "" },
  ]
}

/** Comparação sem atalho (o tempo não denuncia quantas letras bateram). */
function sameText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let d = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return d === 0
}

async function passwordOk(p: Profile, password: string): Promise<boolean> {
  if (p.hash) return bcrypt.compare(password, p.hash)
  // sem senha no banco: a do ambiente (vazia = perfil sem senha configurada, não entra)
  return p.envPassword.length > 0 && sameText(password, p.envPassword)
}

export const AuthService = {
  /** Usuário e senha certos → perfil; senão null (não diz qual dos dois errou). */
  async login(user: string, password: string): Promise<"OWNER" | "EMPLOYEE" | null> {
    const u = normUser(String(user ?? ""))
    const pw = String(password ?? "")
    if (!u || !pw) return null
    for (const p of await profiles()) {
      if (normUser(p.user) === u && (await passwordOk(p, pw))) return p.role
    }
    return null
  },

  /** Usuários atuais (para Configurações → Acesso; nunca as senhas). */
  async users() {
    const ps = await profiles()
    return ps.map((p) => ({ role: p.role, user: p.user, custom: Boolean(p.hash) }))
  },

  /**
   * Troca usuário e/ou senha de um perfil. Pede a senha atual do dono (quem
   * está mudando). Usuário dos dois perfis não pode ser igual.
   */
  async change(input: { role: "OWNER" | "EMPLOYEE"; user?: string; password?: string; ownerPassword: string }) {
    const ps = await profiles()
    const owner = ps.find((p) => p.role === "OWNER")
    if (!owner || !(await passwordOk(owner, String(input.ownerPassword ?? "")))) throw new Error("Senha do dono incorreta")
    const target = ps.find((p) => p.role === input.role)
    const other = ps.find((p) => p.role !== input.role)
    if (!target || !other) throw new Error("Perfil inválido")
    const data: Record<string, string> = {}
    if (input.user !== undefined) {
      const user = String(input.user).trim().slice(0, 60)
      if (user.length < 3) throw new Error("O usuário precisa ter ao menos 3 letras")
      if (normUser(user) === normUser(other.user)) throw new Error("Esse usuário já é do outro perfil")
      data[input.role === "OWNER" ? "authOwnerUser" : "authEmployeeUser"] = user
    }
    if (input.password !== undefined) {
      const pw = String(input.password)
      if (pw.length < MIN_PASSWORD) throw new Error(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres`)
      data[input.role === "OWNER" ? "authOwnerHash" : "authEmployeeHash"] = await bcrypt.hash(pw, 10)
    }
    if (!Object.keys(data).length) throw new Error("Informe o usuário ou a senha nova")
    await prisma.settings.update({ where: { id: SETTINGS_ID }, data })
    // crachás antigos deste perfil deixam de valer (a chave inclui a senha)
    resetAuthStamps()
    return this.users()
  },
}
