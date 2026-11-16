// Lê o NCM (e o CEST) dos itens das notas de compra (XML de NF-e dos
// fornecedores) para preencher o cadastro dos produtos, casando pelo código
// de barras. Roda no navegador (os arquivos não sobem inteiros) e nos testes.

export interface ItemNotaCompra {
  /** código de barras como veio na nota (só dígitos) */
  ean: string
  ncm: string
  cest: string
  nome: string
  arquivo: string
}

export interface NcmPorEan {
  ean: string
  ncm: string
  cest: string
  nome: string
  /** a mesma mercadoria veio com NCMs diferentes em notas diferentes */
  outrosNcm: string[]
  arquivos: number
}

const digitos = (s: string) => s.replace(/\D/g, "")

function tag(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`))
  return m ? m[1].trim() : ""
}

function texto(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

/** GTIN válido (8, 12, 13 ou 14 dígitos, dígito verificador certo). "SEM GTIN" e lixo ficam de fora. */
export function gtinValido(codigo: string): boolean {
  const c = digitos(codigo)
  if (![8, 12, 13, 14].includes(c.length) || /^0+$/.test(c)) return false
  const corpo = c.slice(0, -1)
  let soma = 0
  for (let i = 0; i < corpo.length; i++) {
    const peso = (corpo.length - i) % 2 === 1 ? 3 : 1
    soma += Number(corpo[i]) * peso
  }
  return (10 - (soma % 10)) % 10 === Number(c[c.length - 1])
}

/** Chave para comparar códigos de barras: só dígitos, sem zeros à esquerda. */
export const chaveBarras = (codigo: string | null | undefined) => digitos(String(codigo ?? "")).replace(/^0+/, "")

/** Itens de uma NF-e de compra. Nota de outro tipo (evento, resumo) devolve lista vazia. */
export function itensDaNotaCompra(xml: string, arquivo = ""): ItemNotaCompra[] {
  const itens: ItemNotaCompra[] = []
  const dets = xml.match(/<(?:\w+:)?det\s[^>]*>[\s\S]*?<\/(?:\w+:)?det>/g) ?? []
  for (const det of dets) {
    const prod = tag(det, "prod")
    if (!prod) continue
    const ncm = digitos(tag(prod, "NCM"))
    if (ncm.length !== 8 || ncm === "00000000") continue
    const ean = [tag(prod, "cEAN"), tag(prod, "cEANTrib")].map(digitos).find(gtinValido)
    if (!ean) continue
    const cest = digitos(tag(prod, "CEST"))
    itens.push({ ean, ncm, cest: cest.length === 7 ? cest : "", nome: texto(tag(prod, "xProd")), arquivo })
  }
  return itens
}

/** Junta os itens de várias notas: um NCM por código de barras (o mais frequente). */
export function juntarPorEan(itens: ItemNotaCompra[]): NcmPorEan[] {
  const grupos = new Map<string, ItemNotaCompra[]>()
  for (const it of itens) {
    const k = chaveBarras(it.ean)
    grupos.set(k, [...(grupos.get(k) ?? []), it])
  }
  const out: NcmPorEan[] = []
  for (const lista of grupos.values()) {
    const contagem = new Map<string, number>()
    for (const it of lista) contagem.set(it.ncm, (contagem.get(it.ncm) ?? 0) + 1)
    const [ncm] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]
    const base = lista.find((it) => it.ncm === ncm) ?? lista[0]
    const cest = lista.find((it) => it.ncm === ncm && it.cest)?.cest ?? ""
    out.push({
      ean: base.ean,
      ncm,
      cest,
      nome: base.nome,
      outrosNcm: [...contagem.keys()].filter((n) => n !== ncm),
      arquivos: new Set(lista.map((it) => it.arquivo)).size,
    })
  }
  return out
}
