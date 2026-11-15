// Roda uma vez quando o servidor Next sobe (em cada PC da loja).
// Liga o backup automático diário — só no runtime Node (precisa de disco).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // colunas novas (ex.: NCM do produto para a NFC-e) antes da 1ª tela consultar
  const { ensureSchema } = await import("@/lib/schemaUpgrade")
  ensureSchema().catch(() => {}) // sem internet agora: o login tenta de novo
  const { startBackupScheduler } = await import("@/services/backupService")
  startBackupScheduler()
}
