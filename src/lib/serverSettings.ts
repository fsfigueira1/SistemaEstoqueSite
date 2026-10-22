// Leitura das configurações no servidor (inclui a chave da IA, que nunca vai
// para o navegador). Garante o schema novo antes de tocar na tabela.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { SECRET_COLUMNS } from "@/lib/backupFormat"

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

/**
 * Versão segura para o navegador: sem as chaves, só se existem e o final delas.
 * Tira toda coluna listada em SECRET_COLUMNS.Settings (a mesma lista que o
 * backup usa) — chave nova cadastrada lá some daqui sozinha.
 */
export function publicSettings(s: ServerSettings) {
  const secret = new Set<string>(SECRET_COLUMNS.Settings ?? [])
  const rest = Object.fromEntries(Object.entries(s).filter(([k]) => !secret.has(k)))
  const key = (s.aiApiKey ?? "").trim()
  const shopping = (s.shoppingApiKey ?? "").trim()
  const nvidia = (s.nvidiaApiKey ?? "").trim()
  return {
    ...(rest as Omit<ServerSettings, "aiApiKey" | "shoppingApiKey" | "nvidiaApiKey">),
    aiKeySet: key.length > 0,
    aiKeyHint: hint(key),
    shoppingKeySet: shopping.length > 0,
    shoppingKeyHint: hint(shopping),
    nvidiaKeySet: nvidia.length > 0,
    nvidiaKeyHint: hint(nvidia),
  }
}
