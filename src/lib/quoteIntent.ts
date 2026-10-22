// CÓPIA de LacolariaSite/lib/whatsapp/siteOrder.ts e de partes de
// LacolariaSite/lib/whatsapp/bot.ts — mantenha em sincronia.
//
// Atendimento (copiloto): o que o cliente mandou no WhatsApp? Pedido do botão
// do site ("#ORC-SITE v1"), código de lista salva ("#L-XXXX"), lista de
// material digitada ou uma mensagem comum. Testado em quoteIntent.test.ts.
import { parseList } from "@/lib/schoolList"

export type ItemSite = { qtd: number; descricao: string; sku: string | null; secao: "material" | "uniforme" | null }
export type GrupoSite = { titulo: string; itens: ItemSite[] }
export type SiteOrder = { versao: 1; grupos: GrupoSite[] }

const MARCA_V1 = "#ORC-SITE v1"
const ITEM = /^- (\d+)x (.+?)(?: \[SKU ([^\]]+)\])?$/
const GRUPO = /^\*(.+)\*$/

/**
 * null quando a mensagem não é do site (não tem a linha da marca). O site põe
 * a marca na última linha, mas o cliente pode escrever algo depois ("pode
 * separar pra sexta?") — o que vem depois da marca é ignorado.
 */
export function parseOrcamentoSite(texto: string): SiteOrder | null {
  const todas = texto.split(/\r?\n/).map((l) => l.trim())
  const fim = todas.lastIndexOf(MARCA_V1)
  if (fim < 0) return null
  const grupos: GrupoSite[] = []
  let grupo: GrupoSite | null = null
  let secao: ItemSite["secao"] = null
  for (const l of todas.slice(0, fim)) {
    const g = GRUPO.exec(l)
    if (g) {
      grupo = { titulo: g[1].trim(), itens: [] }
      grupos.push(grupo)
      secao = null
      continue
    }
    if (/^material escolar:$/i.test(l)) {
      secao = "material"
      continue
    }
    if (/^uniforme:$/i.test(l)) {
      secao = "uniforme"
      continue
    }
    const m = ITEM.exec(l)
    if (!m) continue
    const qtd = Number(m[1])
    if (!Number.isInteger(qtd) || qtd < 1) continue
    if (!grupo) {
      grupo = { titulo: "", itens: [] }
      grupos.push(grupo)
    }
    grupo.itens.push({ qtd, descricao: m[2].trim(), sku: m[3]?.trim() || null, secao })
  }
  return { versao: 1, grupos }
}

export function extractListCode(text: string): string | null {
  const m = /(?:^|[^A-Za-z0-9])#?(L-[A-Za-z0-9]{4})(?![A-Za-z0-9])/i.exec(text)
  return m ? m[1].toUpperCase() : null
}

export function looksLikeList(text: string): boolean {
  return parseList(text).length >= 2 || /^\s*\d+\s+\S/m.test(text)
}

/** Linha que começa com quantidade ("2 lápis", "- 3x borracha", "1. 02 cadernos"). */
export const EXPLICIT_QTY = /^\s*(?:[-•*]\s*)?(?:\d+[.)]\s+)?\d+\s*x?\s+\S/i

export type Intent =
  | { kind: "site"; order: SiteOrder }
  | { kind: "code"; code: string }
  /** code: a lista tinha algo como "l-azul" — tentar como código antes, se existir */
  | { kind: "list"; code?: string }
  | { kind: "other" }

export function classify(text: string): Intent {
  const order = parseOrcamentoSite(text)
  if (order) return { kind: "site", order }
  const code = extractListCode(text)
  if (looksLikeList(text)) return code ? { kind: "list", code } : { kind: "list" }
  if (code) return { kind: "code", code }
  return { kind: "other" }
}
