import { describe, it, expect } from "vitest"
import { authSecret, signToken, verifyToken } from "./authToken"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cjs = require("../../electron/authToken.cjs") as { authSecret: (e: object) => string; signToken: (s: string, r: string, e: number) => string; newSecret: () => string }

const SECRET = "segredo-de-teste-com-mais-de-16"
const NOW = 1_800_000_000_000

describe("crachá do login (cookie assinado)", () => {
  it("assina e confere: perfil e validade", async () => {
    const t = await signToken(SECRET, "EMPLOYEE", NOW + 60_000)
    expect(await verifyToken(SECRET, t, NOW)).toEqual({ role: "EMPLOYEE", expiresAt: NOW + 60_000 })
  })

  it("não aceita vencido, outro segredo, adulterado ou formato antigo", async () => {
    const t = await signToken(SECRET, "EMPLOYEE", NOW + 60_000)
    expect(await verifyToken(SECRET, t, NOW + 60_001)).toBeNull()
    expect(await verifyToken("outro-segredo-qualquer-123", t, NOW)).toBeNull()
    expect(await verifyToken(SECRET, t.replace("EMPLOYEE", "OWNER"), NOW)).toBeNull()
    expect(await verifyToken(SECRET, "OWNER:1730000000000", NOW)).toBeNull()
    expect(await verifyToken(SECRET, "auto:1", NOW)).toBeNull()
  })

  it("o aplicativo (electron/authToken.cjs) assina igual ao servidor", async () => {
    expect(cjs.signToken(SECRET, "ROBOT", NOW + 1000)).toBe(await signToken(SECRET, "ROBOT", NOW + 1000))
    const env = { DATABASE_URL: "postgresql://u:senha-do-banco@host/db" }
    expect(cjs.authSecret(env)).toBe(await authSecret(env))
    const strong = "a".repeat(64)
    expect(cjs.authSecret({ AUTH_SECRET: strong })).toBe(strong)
    expect(await authSecret({ AUTH_SECRET: strong })).toBe(strong)
  })

  it("sem segredo forte e sem senha do banco: recusa (nada de segredo fixo adivinhável)", async () => {
    for (const env of [{}, { DATABASE_URL: "" }, { DATABASE_URL: "postgresql://host/db" }, { DATABASE_URL: "postgresql://u:123@host/db" }, { AUTH_SECRET: "curto-demais" }]) {
      await expect(authSecret(env)).rejects.toThrow(/AUTH_SECRET/)
      expect(() => cjs.authSecret(env)).toThrow(/AUTH_SECRET/)
    }
  })
})
