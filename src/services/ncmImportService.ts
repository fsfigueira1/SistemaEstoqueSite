// NCM dos produtos a partir das notas de compra: casa o código de barras dos
// itens das notas (lidos no navegador, ver lib/ncmFromNfe) com o cadastro,
// mostra a prévia e grava só o que a dona confirmar.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { chaveBarras, type NcmPorEan } from "@/lib/ncmFromNfe"

export type NcmSituacao = "novo" | "igual" | "diferente"

export interface NcmPrevia {
  productId: string
  nome: string
  barcode: string
  ncmAtual: string
  ncmNota: string
  cestAtual: string
  cestNota: string
  nomeNaNota: string
  /** NCMs diferentes vistos para o mesmo código em outras notas */
  outrosNcm: string[]
  situacao: NcmSituacao
}

export interface NcmPreviaResultado {
  linhas: NcmPrevia[]
  /** códigos das notas que não estão no cadastro */
  semCadastro: number
  /** produtos que continuam sem NCM depois de aplicar tudo */
  continuamSemNcm: number
  totalProdutos: number
}

const MAX = 20_000
const so = (s: unknown, n: number) => {
  const d = String(s ?? "").replace(/\D/g, "")
  return d.length === n ? d : ""
}

export function limparEntrada(raw: unknown): NcmPorEan[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const ean = String(o.ean ?? "").replace(/\D/g, "")
    const ncm = so(o.ncm, 8)
    if (!ean || !ncm) return []
    return [
      {
        ean,
        ncm,
        cest: so(o.cest, 7),
        nome: String(o.nome ?? "").slice(0, 200),
        outrosNcm: Array.isArray(o.outrosNcm) ? o.outrosNcm.map((n) => so(n, 8)).filter(Boolean).slice(0, 5) : [],
        arquivos: Number(o.arquivos) || 1,
      },
    ]
  })
}

const ordem: Record<NcmSituacao, number> = { diferente: 0, novo: 1, igual: 2 }

export async function previaNcm(itens: NcmPorEan[]): Promise<NcmPreviaResultado> {
  await ensureSchema()
  const produtos = await prisma.product.findMany({ select: { id: true, name: true, barcode: true, ncm: true, cest: true } })
  const porChave = new Map(produtos.filter((p) => p.barcode).map((p) => [chaveBarras(p.barcode), p]))
  const linhas: NcmPrevia[] = []
  let semCadastro = 0
  for (const it of itens) {
    const p = porChave.get(chaveBarras(it.ean))
    if (!p) {
      semCadastro++
      continue
    }
    const ncmAtual = p.ncm ?? ""
    linhas.push({
      productId: p.id,
      nome: p.name,
      barcode: p.barcode ?? "",
      ncmAtual,
      ncmNota: it.ncm,
      cestAtual: p.cest ?? "",
      cestNota: it.cest,
      nomeNaNota: it.nome,
      outrosNcm: it.outrosNcm,
      situacao: !ncmAtual ? "novo" : ncmAtual === it.ncm ? "igual" : "diferente",
    })
  }
  const comNcmDepois = new Set([...produtos.filter((p) => p.ncm).map((p) => p.id), ...linhas.map((l) => l.productId)])
  linhas.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR"))
  return { linhas, semCadastro, continuamSemNcm: produtos.length - comNcmDepois.size, totalProdutos: produtos.length }
}

/** Grava o NCM (e o CEST, quando a nota trouxe) dos produtos escolhidos. */
export async function aplicarNcm(raw: unknown): Promise<{ atualizados: number }> {
  await ensureSchema()
  const lista = Array.isArray(raw) ? raw.slice(0, MAX) : []
  const updates = lista.flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const id = typeof o.productId === "string" ? o.productId : ""
    const ncm = so(o.ncm, 8)
    return id && ncm ? [{ id, ncm, cest: so(o.cest, 7) }] : []
  })
  let atualizados = 0
  for (let i = 0; i < updates.length; i += 200) {
    const lote = updates.slice(i, i + 200)
    const res = await prisma.$transaction(
      lote.map((u) =>
        prisma.product.updateMany({ where: { id: u.id }, data: u.cest ? { ncm: u.ncm, cest: u.cest } : { ncm: u.ncm } }),
      ),
    )
    atualizados += res.reduce((s, r) => s + r.count, 0)
  }
  return { atualizados }
}
