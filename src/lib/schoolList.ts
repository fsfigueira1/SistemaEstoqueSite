// Lista de material escolar → orçamento com o que tem em estoque.
// Regras puras (sem banco): ler as linhas da lista (texto colado ou lido da
// foto), achar a quantidade e casar cada item com os produtos da loja.
// Testado em schoolList.test.ts.

export type ListLine = {
  /** Linha como veio (para a pessoa conferir). */
  raw: string
  qty: number
  /** Descrição sem a quantidade. */
  text: string
}

export type CatalogProduct = {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  salePrice: number
  stock: number
  category?: string | null
}

export type Candidate = { product: CatalogProduct; score: number }

// ---------- normalização ----------
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, quinze: 15, vinte: 20,
}

// abreviações comuns em lista de escola
const ABBREV: Record<string, string> = {
  cx: "caixa", cxs: "caixa", pct: "pacote", pcte: "pacote", pc: "pacote", pcts: "pacote",
  cad: "caderno", univ: "universitario", fls: "folha", fl: "folha", fol: "folha", folhas: "folha",
  lap: "lapis", borr: "borracha", tes: "tesoura", col: "cola", mat: "materia", materias: "materia",
  gr: "grama", g: "grama", ml: "ml", cm: "cm", un: "", und: "", unid: "", unidade: "", unidades: "",
  "n°": "", "nº": "", no: "",
}

const STOP = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para", "pra", "e", "em", "a", "o", "as", "os", "ou", "tipo",
  "marca", "sugestao", "preferencia", "qualquer", "bom", "boa", "qualidade", "tamanho", "modelo", "unidade", "uso",
  "individual", "coletivo", "obs", "etc", "x",
])

/** Plural → singular, bem simples (o mesmo corte vale para produto e lista). */
export function stem(w: string): string {
  if (w.length <= 3 || /^\d/.test(w)) return w
  if (w.endsWith("oes") || w.endsWith("aes")) return w.slice(0, -3) + "ao"
  if (w.endsWith("eis")) return w.slice(0, -3) + "el"
  if (w.endsWith("is") && w.length > 5 && !w.endsWith("lapis")) return w.slice(0, -2) + "l"
  if (/(r|z|l)es$/.test(w)) return w.slice(0, -2)
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("lapis")) return w.slice(0, -1)
  return w
}

export function tokens(s: string): string[] {
  const out: string[] = []
  for (let w of norm(s).split(/[^a-z0-9°º]+/)) {
    if (!w) continue
    if (w in ABBREV) w = ABBREV[w]
    if (!w || STOP.has(w)) continue
    // "12cores" / "200fls" → número + palavra
    const m = /^(\d+)([a-z]+)$/.exec(w)
    if (m) {
      out.push(m[1])
      const unit = ABBREV[m[2]] ?? m[2]
      if (unit && !STOP.has(unit)) out.push(stem(unit))
      continue
    }
    out.push(stem(w))
  }
  return out
}

// ---------- leitura da lista ----------
const NOISE =
  /^(lista|material(es)? (escolar|de uso|para)|escola|colegio|col\.|ano letivo|turma|serie|\d+[ºo°]? ano|ensino|educacao|professor|obs|observa|nome|data|entregar|entrega|os materiais|todo material|todos os materiais|livros?:|livro did)/

/** Divide o texto em itens e acha a quantidade de cada um. */
export function parseList(text: string): ListLine[] {
  const rawLines = text
    .replace(/\r/g, "")
    .split(/\n|;|•|·/)
    .map((l) => l.trim())
    .filter(Boolean)
  const out: ListLine[] = []
  for (const raw of rawLines) {
    let line = raw
      .replace(/^[-–—*•·>\]]+\s*/, "")
      .replace(/^\(?[a-z]\)\s+/i, "") // "a) "
      .replace(/^\d{1,2}[.)]\s+(?=\d)/, "") // "1. 02 cadernos" → numeração antes da quantidade
      .trim()
    const n = norm(line).replace(/^[([{"'“]+/, "")
    if (!/[a-z]{3,}/.test(n)) continue // só números/símbolos
    if (NOISE.test(n)) continue

    let qty = 1
    // quantidade no começo: "02 cadernos", "2x caderno", "2 - caderno", "(2) caderno", "2 un. de ..."
    const lead = /^\(?(\d{1,3})\)?\s*(x|un\.?|und\.?|unid\.?|unidades?|-|–|:)?\s+(?=\D)/i.exec(line)
    if (lead && Number(lead[1]) > 0 && Number(lead[1]) <= 200) {
      qty = Number(lead[1])
      line = line.slice(lead[0].length)
    } else {
      const word = /^(um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte)\s+/i.exec(line)
      if (word) {
        qty = NUMBER_WORDS[norm(word[1])] ?? 1
        line = line.slice(word[0].length)
      } else {
        // no fim: "caderno brochura - 2 unidades", "caderno (2)", "borracha 3un"
        const tail = /[\s(–-]+(\d{1,3})\s*(x|un\.?|und\.?|unid\.?|unidades?)?\)?\s*$/i.exec(line)
        if (tail && (tail[2] || /[(–-]/.test(tail[0])) && Number(tail[1]) > 0 && Number(tail[1]) <= 200) {
          qty = Number(tail[1])
          line = line.slice(0, tail.index)
        }
      }
    }
    line = line.replace(/^(de|do|da)\s+/i, "").replace(/\s{2,}/g, " ").replace(/[.,;:\-–]+$/, "").trim()
    if (!/[a-z]{3,}/i.test(norm(line))) continue
    out.push({ raw, qty, text: line })
  }
  return out
}

// ---------- casar com os produtos ----------
// embalagem ("1 caixa de…", "1 pacote de…") não é o item em si
const PACK = new Set(["caixa", "pacote", "resma", "kit", "jogo", "conjunto", "tubo", "frasco", "pote", "rolo", "cartela", "refil", "embalagem"])
const weight = (t: string) => (/^\d+$/.test(t) ? 1.5 : PACK.has(t) ? 0.3 : 1)

/** Nota de 0 a 1 de quanto o produto parece o item da lista. */
export function matchScore(itemText: string, product: CatalogProduct): number {
  const q = [...new Set(tokens(itemText))]
  const p = new Set(tokens(`${product.name} ${product.category ?? ""}`))
  if (!q.length || !p.size) return 0
  let hit = 0
  let total = 0
  for (const t of q) {
    total += weight(t)
    if (p.has(t)) hit += weight(t)
    else if (t.length >= 5 && [...p].some((x) => x.length >= 5 && (x.startsWith(t) || t.startsWith(x)))) hit += weight(t) * 0.7
  }
  const recall = hit / total
  const pWords = [...p].filter((t) => !/^\d+$/.test(t)).length || 1
  const precision = Math.min(1, hit / pWords)
  let score = 0.75 * recall + 0.25 * precision
  // o substantivo principal ("caderno", "lapis", "cola"…) precisa bater
  const head = q.find((t) => !/^\d+$/.test(t) && !PACK.has(t))
  if (head && !p.has(head) && ![...p].some((x) => x.length >= 5 && head.length >= 5 && (x.startsWith(head) || head.startsWith(x)))) {
    score = Math.min(score, 0.35)
  }
  // número diferente (12 cores × 24 cores) pesa contra
  const qNums = q.filter((t) => /^\d+$/.test(t))
  const pNums = [...p].filter((t) => /^\d+$/.test(t))
  if (qNums.length && pNums.length && !qNums.some((n) => p.has(n))) score -= 0.15
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
}

export const MATCH_MIN = 0.5

/** Melhores produtos para um item (com estoque na frente quando empatam). */
export function findCandidates(itemText: string, catalog: CatalogProduct[], limit = 4): Candidate[] {
  return catalog
    .map((product) => ({ product, score: matchScore(itemText, product) }))
    .filter((c) => c.score >= 0.2)
    .sort((a, b) => {
      const d = b.score - a.score
      if (Math.abs(d) > 0.05) return d
      const sa = a.product.stock > 0 ? 1 : 0
      const sb = b.product.stock > 0 ? 1 : 0
      return sb - sa || d
    })
    .slice(0, limit)
}

export type QuoteLine = ListLine & {
  candidates: Candidate[]
  /** Produto escolhido (o melhor, se passou da nota mínima). */
  productId: string | null
}

export function buildQuote(text: string, catalog: CatalogProduct[]): QuoteLine[] {
  return parseList(text).map((l) => {
    const candidates = findCandidates(l.text, catalog)
    const best = candidates[0]
    return { ...l, candidates, productId: best && best.score >= MATCH_MIN ? best.product.id : null }
  })
}

export type QuoteTotals = { total: number; items: number; missing: number; short: number }

/** Totais do orçamento: só o que tem na loja entra no valor. */
export function quoteTotals(
  lines: Array<{ qty: number; product: CatalogProduct | null; skip?: boolean }>,
): QuoteTotals {
  let total = 0
  let items = 0
  let missing = 0
  let short = 0
  for (const l of lines) {
    if (l.skip) continue
    if (!l.product) {
      missing++
      continue
    }
    const take = Math.min(l.qty, Math.max(0, l.product.stock))
    if (take < l.qty) short++
    total += take * l.product.salePrice
    items += take
  }
  return { total: Math.round(total * 100) / 100, items, missing, short }
}

/** Texto do orçamento para mandar ao cliente. */
export function quoteMessage(
  store: string,
  title: string,
  lines: Array<{ qty: number; product: CatalogProduct | null; text: string; skip?: boolean }>,
  brl: (v: number) => string,
): string {
  const ok: string[] = []
  const miss: string[] = []
  let total = 0
  for (const l of lines) {
    if (l.skip) continue
    if (!l.product || l.product.stock <= 0) {
      miss.push(`• ${l.qty} × ${l.text}`)
      continue
    }
    const take = Math.min(l.qty, l.product.stock)
    total += take * l.product.salePrice
    ok.push(`• ${take} × ${l.product.name} — ${brl(take * l.product.salePrice)}`)
    if (take < l.qty) miss.push(`• ${l.qty - take} × ${l.text} (faltou)`)
  }
  return [
    `Orçamento ${store}${title ? ` — ${title}` : ""}`,
    "",
    ...ok,
    "",
    `Total: ${brl(Math.round(total * 100) / 100)}`,
    ...(miss.length ? ["", "Não temos no momento:", ...miss] : []),
  ].join("\n")
}
