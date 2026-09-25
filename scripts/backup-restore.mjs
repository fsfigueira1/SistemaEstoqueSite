#!/usr/bin/env node
// Restaura um backup do Laçolaria (lacolaria-backup-*.json.gz) no banco.
//
//   npm run backup:restore -- "C:\...\lacolaria-backup-2026-09-25-1830.json.gz"          (só mostra o que faria)
//   npm run backup:restore -- "C:\...\lacolaria-backup-2026-09-25-1830.json.gz" --yes    (grava)
//
// Banco: DATABASE_URL do ambiente ou do .env (ou --database-url=...).
// Só INSERE o que falta (linhas com o mesmo id são mantidas como estão), na
// ordem certa (pais antes dos filhos), tudo numa transação: se algo falhar,
// nada é gravado. Serve para montar um banco novo a partir do arquivo ou para
// recuperar registros apagados. As tabelas precisam existir (abra o app uma
// vez apontando para o banco novo, ou rode `npm run db:migrate`).
// As chaves de API não vão no backup: cadastre de novo em Configurações.
import fs from "node:fs"
import zlib from "node:zlib"
import "dotenv/config"
import postgres from "postgres"

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const write = args.includes("--yes")
const urlArg = args.find((a) => a.startsWith("--database-url="))
const url = urlArg ? urlArg.slice("--database-url=".length) : process.env.DATABASE_URL

if (!file) {
  console.error("Uso: npm run backup:restore -- <arquivo.json.gz> [--yes] [--database-url=...]")
  process.exit(1)
}
if (!url) {
  console.error("DATABASE_URL não definida (use o .env ou --database-url=...).")
  process.exit(1)
}

const backup = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"))
if (backup.format !== "lacolaria-backup") {
  console.error("Este arquivo não é um backup do Laçolaria.")
  process.exit(1)
}
console.log(`Backup de ${new Date(backup.createdAt).toLocaleString("pt-BR")} (${backup.computer}, app ${backup.app ?? "?"})`)

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} })
const qi = (n) => `"${String(n).replace(/"/g, '""')}"`
const CHUNK = 500

try {
  const cols = await sql`
    SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = 'public'`
  const existing = new Map()
  for (const { t, c } of cols) {
    if (!existing.has(t)) existing.set(t, new Set())
    existing.get(t).add(c)
  }

  const plan = []
  for (const table of backup.order) {
    const rows = backup.tables[table] ?? []
    if (!existing.has(table)) {
      console.log(`  ! ${table}: tabela não existe neste banco — pulando ${rows.length} linha(s)`)
      continue
    }
    if (!rows.length) continue
    const keys = Object.keys(rows[0]).filter((k) => existing.get(table).has(k))
    plan.push({ table, rows, keys })
  }

  if (!write) {
    for (const p of plan) console.log(`  ${p.table}: ${p.rows.length} linha(s) no arquivo`)
    console.log("\nNada foi gravado. Para restaurar de verdade, rode de novo com --yes.")
  } else {
    await sql.begin(async (tx) => {
      for (const { table, rows, keys } of plan) {
        const list = keys.map(qi).join(", ")
        let inserted = 0
        for (let i = 0; i < rows.length; i += CHUNK) {
          const part = rows.slice(i, i + CHUNK)
          const r = await tx.unsafe(
            `INSERT INTO ${qi(table)} (${list})
             SELECT ${list} FROM json_populate_recordset(NULL::${qi(table)}, ($1::text)::json)
             ON CONFLICT DO NOTHING`,
            [JSON.stringify(part)],
          )
          inserted += r.count
        }
        console.log(`  ${table}: ${inserted} de ${rows.length} restaurada(s)`)
      }
    })
    console.log("\nPronto. Linhas que já existiam foram mantidas como estavam.")
  }
} catch (e) {
  console.error("\nFalhou — nada foi gravado:", e.message ?? e)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
