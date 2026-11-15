// Venda do sistema -> itens, pagamentos, desconto e acréscimo da NFC-e (sem banco).
import { onlyDigits } from "@/lib/nfce/format"
import type { NfceConfig } from "@/lib/nfce/config"
import type { NfceItem, NfcePagamento, TPag } from "@/lib/nfce/types"

const TPAG: Record<string, TPag> = { CASH: "01", CREDIT_CARD: "03", DEBIT_CARD: "04", PIX: "17" }

const UNIDADES: Record<string, string> = {
  unidade: "UN",
  un: "UN",
  pacote: "PCT",
  caixa: "CX",
  metro: "M",
  kg: "KG",
  litro: "L",
  rolo: "RL",
  par: "PAR",
  kit: "KIT",
}

export const unidadeComercial = (u: string | null | undefined) =>
  UNIDADES[String(u ?? "").trim().toLowerCase()] ?? (String(u ?? "").trim().toUpperCase().slice(0, 6) || "UN")

type Num = { toNumber(): number }

export interface VendaParaNota {
  subtotal: Num
  discountAmount: Num
  totalAmount: Num
  items: Array<{
    productName: string | null
    quantity: number
    unitPrice: Num
    discountAmount: Num
    product: { id: string; name: string; sku: string; barcode: string | null; unit: string; ncm: string | null; cest: string | null } | null
  }>
  payments: Array<{ method: string; amount: Num; status: string; refundedAt: Date | null }>
}

export interface PartesDaNota {
  itens: NfceItem[]
  pagamentos: NfcePagamento[]
  descontoTotal: number
  acrescimoTotal: number
  /** Produtos sem NCM (nem no cadastro nem o padrão). */
  semNcm: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function partesDaVenda(sale: VendaParaNota, cfg: NfceConfig): PartesDaNota {
  const semNcm: string[] = []
  const itens: NfceItem[] = sale.items.map((it) => {
    const p = it.product
    const ncm = onlyDigits(p?.ncm) || cfg.ncmPadrao
    if (ncm.length !== 8) semNcm.push(p?.name ?? it.productName ?? "item avulso")
    return {
      codigo: p?.sku || p?.id.slice(0, 8) || "AVULSO",
      ean: p?.barcode ?? undefined,
      descricao: p?.name ?? it.productName ?? "Item",
      ncm,
      cest: p?.cest ?? undefined,
      cfop: cfg.cfopPadrao,
      unidade: unidadeComercial(p?.unit),
      quantidade: it.quantity,
      valorUnitario: it.unitPrice.toNumber(),
      desconto: it.discountAmount.toNumber(),
      origem: cfg.origemPadrao,
      csosn: cfg.csosnPadrao,
    }
  })

  // Sale.discountAmount = desconto dos itens + desconto da venda; o acréscimo
  // (juros do cartão) fica embutido no total (ver saleService).
  const subtotal = sale.subtotal.toNumber()
  const descontoVenda = sale.discountAmount.toNumber()
  const descItens = sale.items.reduce((a, it) => a + it.discountAmount.toNumber(), 0)
  const descontoTotal = Math.max(0, r2(descontoVenda - descItens))
  const acrescimoTotal = Math.max(0, r2(sale.totalAmount.toNumber() - (subtotal - descontoVenda)))

  const pagamentos: NfcePagamento[] = sale.payments
    .filter((p) => !p.refundedAt && p.status !== "REFUNDED" && p.status !== "FAILED")
    .map((p) => ({ tPag: TPAG[p.method] ?? "99", valor: p.amount.toNumber() }))
  if (!pagamentos.length) pagamentos.push({ tPag: "01", valor: sale.totalAmount.toNumber() })

  return { itens, pagamentos, descontoTotal, acrescimoTotal, semNcm }
}
