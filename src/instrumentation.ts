// Roda uma vez quando o servidor Next sobe (em cada PC da loja).
// Liga o backup automático diário — só no runtime Node (precisa de disco).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startBackupScheduler } = await import("@/services/backupService")
  startBackupScheduler()
}
