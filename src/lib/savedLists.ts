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

/**
 * Chave para achar a mesma série escrita de outro jeito ("3º ano" = "3o Ano"
 * = "3° ano"), senão salvar de novo criaria outra lista com outro código.
 */
export const gradeKey = (grade: string) =>
  norm(grade)
    .replace(/[º°]/g, "o")
    .replace(/ª/g, "a")
    .replace(/[^a-z0-9]+/g, "")

const ORDINALS: Record<string, string> = { primeiro: "1", segundo: "2", terceiro: "3", quarto: "4", quinto: "5", sexto: "6", setimo: "7", oitavo: "8", nono: "9" }

/**
 * Série como o cliente fala → etiqueta comparável: "terceiro ano", "3o ano" e
 * "3º ano do fundamental" = "a3"; "infantil 4" e "4 anos" = "i4"; "1ª série do
 * médio" = "ma1". null quando não dá para saber a série ("3", "a do meu filho").
 */
export function gradeTag(grade: string): string | null {
  const t = norm(grade)
    .replace(/[º°ª]/g, "")
    .replace(/\b(primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono)\b/g, (w) => ORDINALS[w])
  const medio = /\bmedio\b/.test(t) ? "m" : ""
  const infantil = /\binfantil\s*(\d)/.exec(t) ?? /\b(\d)\s*anos\b/.exec(t)
  if (infantil && !medio) return `i${infantil[1]}`
  const ano = /\b(\d{1,2})\s*[oa]?\s*(?:ano|serie)\b/.exec(t)
  return ano ? `${medio}a${ano[1]}` : null
}

export type ActiveList<T> = T & { grade: string; schoolYear: number; schoolName: string }

export type ListPick<T> =
  | { status: "found"; list: ActiveList<T> }
  /** nenhuma lista dessa escola */
  | { status: "no_school"; schools: string[] }
  /** a série não foi entendida ou não tem lista salva; grades = as que têm */
  | { status: "no_grade"; grades: string[] }
  /** duas escolas têm essa série e o cliente não disse qual */
  | { status: "many_schools"; schools: string[] }

const SCHOOL_STOP = new Set(["colegio", "escola", "instituto", "de", "do", "da", "dos", "das", "e", "o", "a"])
const schoolWords = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w && !SCHOOL_STOP.has(w))

/** "são josé", "agostiniano" e a sigla "CSJ" servem para o Colégio São José Agostiniano. */
function sameSchool(asked: string, name: string): boolean {
  const q = schoolWords(asked)
  if (!q.length) return true
  const words = schoolWords(name)
  const initials = norm(name).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 2).map((w) => w[0]).join("")
  return q.every((w) => words.includes(w) || (w.length >= 3 && initials.startsWith(w)))
}

/** Acha a lista ativa pela série (e escola, se o cliente disse); entre anos letivos, a mais nova. */
export function pickList<T>(lists: ActiveList<T>[], grade: string, school = ""): ListPick<T> {
  const uniq = (xs: string[]) => [...new Set(xs)]
  const inSchool = lists.filter((l) => sameSchool(school, l.schoolName))
  if (!inSchool.length) return { status: "no_school", schools: uniq(lists.map((l) => l.schoolName)) }
  const tag = gradeTag(grade)
  const matches = tag ? inSchool.filter((l) => gradeTag(l.grade) === tag) : inSchool.filter((l) => gradeKey(l.grade) === gradeKey(grade))
  if (!matches.length) return { status: "no_grade", grades: uniq(inSchool.map((l) => l.grade)) }
  const schools = uniq(matches.map((l) => l.schoolName))
  if (schools.length > 1) return { status: "many_schools", schools }
  return { status: "found", list: matches.reduce((a, b) => (b.schoolYear > a.schoolYear ? b : a)) }
}

export type SavedItemInput = { raw: string; text: string; qty: number; productId: string | null }

/**
 * Linhas da tela → itens a salvar (as marcadas "Fora" não entram). Linha de
 * lista reaberta cujo produto está inativo hoje mantém o produto salvo — senão
 * salvar de novo perderia a ligação para sempre.
 */
export function toSaveItems(
  rows: Array<{
    raw: string
    text: string
    qty: number
    skip: boolean
    product: { id: string } | null
    savedProductId?: string | null
  }>,
): SavedItemInput[] {
  return rows
    .filter((r) => !r.skip)
    .map((r) => ({ raw: r.raw, text: r.text, qty: r.qty, productId: r.product?.id ?? r.savedProductId ?? null }))
}

export type SavedQuoteLine = {
  raw: string
  text: string
  qty: number
  product: CatalogProduct | null
  /** produto gravado na lista, mesmo que hoje esteja inativo */
  savedProductId: string | null
}

/** Liga os itens salvos ao catálogo atual; produto apagado/inativo vira "não temos". */
export function savedLines(items: SavedItemInput[], catalog: Map<string, CatalogProduct>): SavedQuoteLine[] {
  return items.map((i) => ({
    raw: i.raw,
    text: i.text,
    qty: i.qty,
    product: i.productId ? (catalog.get(i.productId) ?? null) : null,
    savedProductId: i.productId,
  }))
}
