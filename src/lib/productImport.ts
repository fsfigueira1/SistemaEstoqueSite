// Importar produtos de uma planilha (CSV do Excel/Google Planilhas).
// Lê o arquivo, entende os nomes de coluna em português e devolve linhas
// prontas para a API. Regras puras — testadas em productImport.test.ts.
import { parseMoney } from "@/lib/closing"

export type ImportRow = {
  line: number
  barcode: string | null
  sku: string | null
  name: string
  category: string | null
  supplier: string | null
  /** Unidades que entram no estoque. */
  qty: number
  cost: number | null
  price: number | null
  minStock: number | null
  description: string | null
  market: { min: number | null; median: number | null; max: number | null } | null
  sources: string[]
}

export const TEMPLATE_HEADER = [
  "codigo_barras",
  "nome",
  "categoria",
  "fornecedor",
  "quantidade",
  "custo",
  "preco",
  "estoque_minimo",
  "descricao",
  "mercado_min",
  "mercado_mediana",
  "mercado_max",
  "fontes",
]

type Field =
  | "barcode" | "sku" | "name" | "category" | "supplier" | "qty" | "cost" | "price" | "minStock"
  | "description" | "mmin" | "mmed" | "mmax" | "sources"

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const ALIASES: Record<string, Field> = {}
const alias = (f: Field, ...names: string[]) => names.forEach((n) => (ALIASES[key(n)] = f))
alias("barcode", "codigo_barras", "código de barras", "codigo de barras", "ean", "gtin", "barcode", "cod barras")
alias("sku", "sku", "codigo interno", "código interno", "referencia", "referência", "ref")
alias("name", "nome", "produto", "nome do produto", "descricao do produto", "name")
alias("category", "categoria", "category")
alias("supplier", "fornecedor", "supplier", "marca/fornecedor")
alias("qty", "quantidade", "qtd", "qtde", "estoque", "entrada", "unidades", "quantity")
alias("cost", "custo", "preco de custo", "preço de custo", "custo unitario", "custo unitário", "cost")
alias("price", "preco", "preço", "preco de venda", "preço de venda", "venda", "price")
alias("minStock", "estoque_minimo", "estoque minimo", "estoque mínimo", "minimo", "mínimo")
alias("description", "descricao", "descrição", "observacao", "observação", "obs")
alias("mmin", "mercado_min", "mercado minimo", "mercado mínimo")
alias("mmed", "mercado_mediana", "mercado mediana", "preco de mercado", "preço de mercado", "mercado")
alias("mmax", "mercado_max", "mercado maximo", "mercado máximo")
alias("sources", "fontes", "links", "fonte")

/** Divide o CSV em células (aspas, ; ou , ou tab — detecta sozinho). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
  const first = src.split("\n", 1)[0] ?? ""
  const count = (c: string) => first.split(c).length - 1
  const sep = [";", "\t", ","].sort((a, b) => count(b) - count(a))[0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ""
    } else if (ch === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const num = (v: string | undefined) => (v == null || !v.trim() ? null : parseMoney(v))

export type ParseResult = { rows: ImportRow[]; errors: string[]; missingColumns: string[] }

export function parseImport(text: string): ParseResult {
  const table = parseCsv(text)
  if (!table.length) return { rows: [], errors: ["Planilha vazia"], missingColumns: [] }
  const header = table[0].map((h) => ALIASES[key(h)] ?? null)
  const missing: string[] = []
  if (!header.includes("name")) missing.push("nome")
  if (!header.includes("barcode") && !header.includes("sku")) missing.push("codigo_barras")
  if (missing.length) return { rows: [], errors: [], missingColumns: missing }

  const rows: ImportRow[] = []
  const errors: string[] = []
  for (let i = 1; i < table.length; i++) {
    const cells: Partial<Record<Field, string>> = {}
    header.forEach((f, j) => {
      if (f) cells[f] = (table[i][j] ?? "").trim()
    })
    const line = i + 1
    const name = (cells.name ?? "").replace(/\s+/g, " ")
    const barcode = (cells.barcode ?? "").replace(/\s/g, "") || null
    const sku = cells.sku || null
    if (!name) {
      errors.push(`Linha ${line}: falta o nome`)
      continue
    }
    if (!barcode && !sku) {
      errors.push(`Linha ${line}: falta o código de barras`)
      continue
    }
    if (barcode && /e\+?\d/i.test(barcode)) {
      errors.push(`Linha ${line}: o Excel estragou o código de barras (${barcode}) — formate a coluna como texto`)
      continue
    }
    const qtyRaw = num(cells.qty)
    const mmed = num(cells.mmed)
    rows.push({
      line,
      barcode,
      sku,
      name,
      category: cells.category || null,
      supplier: cells.supplier || null,
      qty: qtyRaw == null ? 0 : Math.max(0, Math.round(qtyRaw)),
      cost: num(cells.cost),
      price: num(cells.price),
      minStock: cells.minStock ? Math.max(0, Math.round(num(cells.minStock) ?? 0)) : null,
      description: cells.description || null,
      market: mmed != null ? { min: num(cells.mmin), median: mmed, max: num(cells.mmax) } : null,
      sources: (cells.sources ?? "")
        .split(/\s*\|\s*|\s+(?=https?:\/\/)/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//.test(s))
        .slice(0, 8),
    })
  }
  return { rows, errors, missingColumns: [] }
}

/** Chave de uma importação: mesmo arquivo (códigos + quantidades) = mesma chave. */
export function importKey(rows: Array<Pick<ImportRow, "barcode" | "sku" | "qty">>): string {
  const s = rows.map((r) => `${r.barcode ?? r.sku}:${r.qty}`).join("|")
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 + c, 2246822519) >>> 0
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`
}

export const normName = key
