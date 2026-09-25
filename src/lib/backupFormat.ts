// Formato do arquivo de backup e regras puras (sem banco, sem disco), usadas
// pelo backup automático do servidor e pelo script de restauração.

export const BACKUP_FORMAT = "lacolaria-backup"
export const BACKUP_VERSION = 1
export const BACKUP_PREFIX = "lacolaria-backup-"

/** Só estes nomes são listados/baixados/apagados — nada mais da pasta. */
export const BACKUP_FILE_RE = /^lacolaria-backup-\d{4}-\d{2}-\d{2}-\d{4}(-\d{1,3})?\.json\.gz$/

/** Colunas que nunca vão para o arquivo (chaves de API). */
export const SECRET_COLUMNS: Record<string, string[]> = {
  Settings: ["aiApiKey", "shoppingApiKey"],
}

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  version: number
  app: string | null
  createdAt: string
  computer: string
  kind: "auto" | "manual"
  /** Ordem para restaurar (pais antes dos filhos). */
  order: string[]
  counts: Record<string, number>
  tables: Record<string, Array<Record<string, unknown>>>
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0")

/** lacolaria-backup-2026-09-25-1830.json.gz (horário local do PC). */
export function backupFileName(d: Date, suffix = 0): string {
  const base = `${BACKUP_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `${base}${suffix ? `-${suffix}` : ""}.json.gz`
}

/** Dia (AAAA-MM-DD) de um arquivo de backup, ou null se o nome não for de backup. */
export function backupDay(name: string): string | null {
  if (!BACKUP_FILE_RE.test(name)) return null
  return name.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 10)
}

/**
 * Ordena as tabelas para restaurar: quem é referenciado vem antes de quem
 * referencia. Autorreferência é ignorada; ciclos (não deveriam existir) vão
 * para o fim na ordem alfabética.
 */
export function orderTables(tables: string[], fks: Array<{ child: string; parent: string }>): string[] {
  const set = new Set(tables)
  const deps = new Map<string, Set<string>>()
  for (const t of tables) deps.set(t, new Set())
  for (const { child, parent } of fks) {
    if (child !== parent && set.has(child) && set.has(parent)) deps.get(child)?.add(parent)
  }
  const out: string[] = []
  const done = new Set<string>()
  let progress = true
  while (progress && done.size < tables.length) {
    progress = false
    for (const t of [...tables].sort()) {
      if (done.has(t)) continue
      if ([...(deps.get(t) ?? [])].every((p) => done.has(p))) {
        out.push(t)
        done.add(t)
        progress = true
      }
    }
  }
  for (const t of [...tables].sort()) if (!done.has(t)) out.push(t)
  return out
}

/** Remove as colunas secretas das linhas de uma tabela. */
export function stripSecrets(table: string, rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const cols = SECRET_COLUMNS[table]
  if (!cols) return rows
  return rows.map((r) => {
    const copy = { ...r }
    for (const c of cols) if (c in copy) copy[c] = ""
    return copy
  })
}

const sortKey = (name: string) => {
  const m = /^lacolaria-backup-(\d{4}-\d{2}-\d{2}-\d{4})(?:-(\d{1,3}))?\.json\.gz$/.exec(name)
  return m ? `${m[1]}-${(m[2] ?? "0").padStart(3, "0")}` : name
}

/** Só os arquivos de backup, do mais novo para o mais antigo. */
export function newestFirst(names: string[]): string[] {
  return names
    .filter((n) => BACKUP_FILE_RE.test(n))
    .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : sortKey(a) > sortKey(b) ? -1 : 0))
}

/** Quais arquivos apagar para manter só os `keep` mais novos. */
export function filesToPrune(names: string[], keep: number): string[] {
  return newestFirst(names).slice(Math.max(1, keep))
}
