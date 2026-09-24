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

const hint = (k: string) => (k.length > 8 ? `…${k.slice(-4)}` : k ? "definida" : "")

/** Versão segura para o navegador: sem as chaves, só se existem e o final delas. */
export function publicSettings(s: ServerSettings) {
  const { aiApiKey, cosmosToken, ...rest } = s
  const key = (aiApiKey ?? "").trim()
  const cosmos = (cosmosToken ?? "").trim()
  return {
    ...rest,
    aiKeySet: key.length > 0,
    aiKeyHint: hint(key),
    cosmosTokenSet: cosmos.length > 0,
    cosmosTokenHint: hint(cosmos),
  }
}
