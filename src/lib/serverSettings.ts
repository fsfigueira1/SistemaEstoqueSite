// Leitura das configurações no servidor (inclui a chave da IA, que nunca vai
// para o navegador). Garante o schema novo antes de tocar na tabela.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"

export const SETTINGS_ID = "app"

export async function getServerSettings() {
  await ensureSchema()
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
}

export type ServerSettings = Awaited<ReturnType<typeof getServerSettings>>

/** Versão segura para o navegador: sem a chave, só se ela existe e o final dela. */
export function publicSettings(s: ServerSettings) {
  const { aiApiKey, ...rest } = s
  const key = (aiApiKey ?? "").trim()
  return {
    ...rest,
    aiKeySet: key.length > 0,
    aiKeyHint: key.length > 8 ? `…${key.slice(-4)}` : key ? "definida" : "",
  }
}
