// Backup automático diário do banco — um arquivo .json.gz por dia, salvo em
// uma pasta deste computador (cada PC da loja guarda a sua cópia).
//
//  - Pasta: LACOLARIA_BACKUP_DIR (o app Electron define; dá para escolher uma
//    pasta do Google Drive/OneDrive) ou Documentos/Lacolaria Backups.
//  - Conteúdo: todas as tabelas do schema "public", lidas numa transação só
//    (retrato consistente), sem as chaves de API. Usa uma conexão própria e
//    curta — não ocupa o pool do Prisma, então o PDV não espera o backup.
//  - Guarda os N mais novos (Configurações → Backup) e apaga o resto.
//  - Restaurar: `npm run backup:restore -- <arquivo>` (ver RUNBOOK.md).
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import zlib from "node:zlib"
import { promisify } from "node:util"
import postgres from "postgres"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { getServerSettings } from "@/lib/serverSettings"
import { simplifyMessage } from "@/lib/friendlyError"
import {
  BACKUP_FILE_RE,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupDay,
  backupFileName,
  filesToPrune,
  newestFirst,
  orderTables,
  stripSecrets,
  type BackupFile,
} from "@/lib/backupFormat"

const gzip = promisify(zlib.gzip)
const PAGE = 5000
const HOUR = 60 * 60 * 1000

export type BackupEntry = { name: string; size: number; createdAt: string }
export type BackupStatus = {
  enabled: boolean
  keep: number
  dir: string
  running: boolean
  last: BackupEntry | null
  lastError: { at: string; message: string } | null
  files: BackupEntry[]
}

// Estado no globalThis: a rotina agendada (instrumentation) e as rotas da API
// podem ser módulos diferentes no mesmo processo.
type State = { running: boolean; lastError: { at: string; message: string } | null; timer: boolean }
const g = globalThis as unknown as { __lacolariaBackup?: State }
const state: State = (g.__lacolariaBackup ??= { running: false, lastError: null, timer: false })

export function backupDir(): string {
  return process.env.LACOLARIA_BACKUP_DIR || path.join(os.homedir(), "Documents", "Lacolaria Backups")
}

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const qi = (name: string) => `"${name.replace(/"/g, '""')}"`

export async function listBackups(): Promise<BackupEntry[]> {
  const dir = backupDir()
  let names: string[] = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const out: BackupEntry[] = []
  for (const name of newestFirst(names)) {
    try {
      const st = await fs.stat(path.join(dir, name))
      out.push({ name, size: st.size, createdAt: st.mtime.toISOString() })
    } catch {
      /* arquivo sumiu no meio da listagem */
    }
  }
  return out
}

/** Caminho seguro de um arquivo de backup (só nomes no padrão). */
export function backupPath(name: string): string | null {
  return BACKUP_FILE_RE.test(name) ? path.join(backupDir(), name) : null
}

type Query = <T>(text: string) => Promise<T[]>

async function readAll(q: Query): Promise<Pick<BackupFile, "order" | "counts" | "tables">> {
  const tableRows = await q<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  )
  const tables = tableRows.map((r) => r.name).filter((n) => !n.startsWith("_prisma"))
  const fks = await q<{ child: string; parent: string }>(
    `SELECT cl.relname AS child, pl.relname AS parent
       FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.conrelid
       JOIN pg_class pl ON pl.oid = c.confrelid
       JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'`,
  )
  const withId = new Set(
    (
      await q<{ t: string }>(
        `SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id'`,
      )
    ).map((r) => r.t),
  )

  const order = orderTables(tables, fks)
  const out: BackupFile["tables"] = {}
  const counts: Record<string, number> = {}
  for (const t of order) {
    const rows: Array<Record<string, unknown>> = []
    for (let offset = 0; ; offset += PAGE) {
      const sql = withId.has(t)
        ? `SELECT COALESCE(json_agg(x), '[]'::json)::text AS data FROM (SELECT * FROM ${qi(t)} ORDER BY "id" LIMIT ${PAGE} OFFSET ${offset}) x`
        : `SELECT COALESCE(json_agg(x), '[]'::json)::text AS data FROM ${qi(t)} x`
      const [{ data }] = await q<{ data: string }>(sql)
      const page = JSON.parse(data) as Array<Record<string, unknown>>
      rows.push(...page)
      if (!withId.has(t) || page.length < PAGE) break
    }
    out[t] = stripSecrets(t, rows)
    counts[t] = rows.length
  }
  return { order, counts, tables: out }
}

/** Lê tudo numa transação só leitura, com uma conexão própria (fechada no fim). */
async function readSnapshot(): Promise<Pick<BackupFile, "order" | "counts" | "tables">> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL não definida")
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 20, onnotice: () => {} })
  try {
    return (await sql.begin("isolation level repeatable read read only", (tx) =>
      readAll(<T>(text: string) => tx.unsafe(text) as unknown as Promise<T[]>),
    )) as Pick<BackupFile, "order" | "counts" | "tables">
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
}

/** Faz um backup agora. Devolve o arquivo criado. */
export async function createBackup(kind: "auto" | "manual" = "manual"): Promise<BackupEntry> {
  if (state.running) throw new Error("Já tem um backup em andamento. Aguarde um instante.")
  state.running = true
  try {
    await ensureSchema()
    const data = await readSnapshot()
    const file: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      app: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      createdAt: new Date().toISOString(),
      computer: os.hostname(),
      kind,
      ...data,
    }
    const dir = backupDir()
    await fs.mkdir(dir, { recursive: true })
    const now = new Date()
    let name = backupFileName(now)
    for (let i = 2; await exists(path.join(dir, name)); i++) name = backupFileName(now, i)
    const full = path.join(dir, name)
    const tmp = `${full}.tmp`
    await fs.writeFile(tmp, await gzip(Buffer.from(JSON.stringify(file)), { level: 9 }))
    await fs.rename(tmp, full)

    const settings = await getServerSettings()
    const names = await fs.readdir(dir)
    for (const old of filesToPrune(names, settings.backupKeep ?? 30)) {
      await fs.unlink(path.join(dir, old)).catch(() => {})
    }
    // .tmp esquecido (app fechou no meio de um backup antigo)
    for (const n of names.filter((x) => x.startsWith("lacolaria-backup-") && x.endsWith(".json.gz.tmp") && x !== `${name}.tmp`)) {
      const st = await fs.stat(path.join(dir, n)).catch(() => null)
      if (st && Date.now() - st.mtimeMs > HOUR) await fs.unlink(path.join(dir, n)).catch(() => {})
    }
    state.lastError = null
    const st = await fs.stat(full)
    return { name, size: st.size, createdAt: st.mtime.toISOString() }
  } catch (error) {
    state.lastError = { at: new Date().toISOString(), message: simplifyMessage(error) }
    throw error
  } finally {
    state.running = false
  }
}

async function exists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const settings = await getServerSettings()
  const files = await listBackups()
  return {
    enabled: settings.backupEnabled ?? true,
    keep: settings.backupKeep ?? 30,
    dir: backupDir(),
    running: state.running,
    last: files[0] ?? null,
    lastError: state.lastError,
    files,
  }
}

/** Roda uma vez por dia por computador: se hoje ainda não tem arquivo, faz. */
export async function runDailyBackupIfDue(): Promise<BackupEntry | null> {
  if (!process.env.DATABASE_URL || state.running) return null
  const settings = await getServerSettings()
  if (settings.backupEnabled === false) return null
  const today = localDay(new Date())
  const files = await listBackups()
  if (files.some((f) => backupDay(f.name) === today)) return null
  return createBackup("auto")
}

/** Liga a rotina: primeira checagem 3 min depois de abrir, depois de hora em hora. */
export function startBackupScheduler() {
  if (state.timer || process.env.LACOLARIA_BACKUP_DISABLED === "1") return
  state.timer = true
  const tick = () => {
    runDailyBackupIfDue().catch((error) => {
      // aparece em Configurações → Backup
      state.lastError = { at: new Date().toISOString(), message: simplifyMessage(error) }
    })
  }
  setTimeout(tick, 3 * 60 * 1000).unref?.()
  setInterval(tick, HOUR).unref?.()
}
