// Listas escolares salvas (escola + série + ano letivo).
// Regras puras (sem banco): nome da escola → slug, código curto da lista
// (vai no botão do site e na mensagem do WhatsApp), o que entra na lista
// salva e como ligar os itens salvos ao catálogo de hoje — preço e estoque
// nunca ficam gravados, todo orçamento recalcula. Testado em savedLists.test.ts.
import { norm, type CatalogProduct } from "@/lib/schoolList"

export const slugify = (name: string) =>
  norm(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

// sem 0/O/1/I/L: o cliente pode ter que ler o código em voz alta ou digitar
export const LIST_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

export function newListCode(rand: () => number = Math.random): string {
  let code = ""
  for (let i = 0; i < 4; i++) code += LIST_CODE_ALPHABET[Math.floor(rand() * LIST_CODE_ALPHABET.length)]
  return `L-${code}`
}

/** Até junho a loja ainda monta lista do ano corrente; depois, do ano seguinte. */
export const defaultSchoolYear = (now = new Date()) => (now.getMonth() <= 5 ? now.getFullYear() : now.getFullYear() + 1)

/** Mantém o texto da loja ("3º ano"), só arruma os espaços. */
export const normalizeGrade = (grade: string) => grade.trim().replace(/\s+/g, " ")

export type SavedItemInput = { raw: string; text: string; qty: number; productId: string | null }

/** Linhas da tela → itens a salvar (as marcadas "Fora" não entram). */
export function toSaveItems(
  rows: Array<{ raw: string; text: string; qty: number; skip: boolean; product: { id: string } | null }>,
): SavedItemInput[] {
  return rows
    .filter((r) => !r.skip)
    .map((r) => ({ raw: r.raw, text: r.text, qty: r.qty, productId: r.product?.id ?? null }))
}

export type SavedQuoteLine = { raw: string; text: string; qty: number; product: CatalogProduct | null }

/** Liga os itens salvos ao catálogo atual; produto apagado/inativo vira "não temos". */
export function savedLines(items: SavedItemInput[], catalog: Map<string, CatalogProduct>): SavedQuoteLine[] {
  return items.map((i) => ({
    raw: i.raw,
    text: i.text,
    qty: i.qty,
    product: i.productId ? (catalog.get(i.productId) ?? null) : null,
  }))
}
