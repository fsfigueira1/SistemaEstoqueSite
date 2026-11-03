// Chave de assinatura de cada perfil = segredo do servidor + "carimbo" do
// login atual daquele perfil (usuário e hash da senha no banco). Trocar a
// senha em Configurações → Acesso muda o carimbo e derruba na hora todo
// crachá antigo daquele perfil — quem sabia a senha velha sai em até 15 s.
// O robô do WhatsApp não tem senha: assina só com o segredo (electron/authToken.cjs).
// Só no servidor (lê o banco). Testado em tests/proxy.test.ts.
import { authSecret, type Role } from "@/lib/authToken"
import { getServerSettings } from "@/lib/serverSettings"

const TTL_MS = 15_000
type Stamps = Record<"OWNER" | "EMPLOYEE", string>
let cache: { at: number; stamps: Stamps } | null = null

async function stamps(): Promise<Stamps> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stamps
  try {
    const s = await getServerSettings()
    const fresh = { OWNER: `${s.authOwnerUser}|${s.authOwnerHash}`, EMPLOYEE: `${s.authEmployeeUser}|${s.authEmployeeHash}` }
    cache = { at: Date.now(), stamps: fresh }
    return fresh
  } catch (err) {
    // banco fora do ar por um instante: segue com o último carimbo conhecido
    if (cache) return cache.stamps
    throw err
  }
}

/** Esquece o carimbo guardado (logo depois de trocar usuário/senha). */
export function resetAuthStamps() {
  cache = null
}

/** Chave para assinar/conferir o crachá deste perfil. */
export async function sessionKey(role: Role, secret?: string): Promise<string> {
  const base = secret ?? (await authSecret())
  if (role === "ROBOT") return base
  const stamp = (await stamps())[role]
  return stamp === "|" ? base : `${base}|${stamp}`
}

/** Todas as chaves de uma vez (o proxy só sabe o perfil depois de ler o crachá). */
export async function sessionKeys(secret: string): Promise<Record<Role, string>> {
  return { OWNER: await sessionKey("OWNER", secret), EMPLOYEE: await sessionKey("EMPLOYEE", secret), ROBOT: secret }
}
