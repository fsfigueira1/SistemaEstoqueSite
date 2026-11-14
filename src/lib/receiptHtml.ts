// Comprovante de compra (NÃO fiscal) em HTML para a térmica — mesmo padrão
// do DANFE NFC-e (src/lib/thermalPrint.ts): cupom de 70 mm, só preto no branco,
// tabela de itens com table-layout fixed (nome longo quebra a linha).
import { PAY_RECEIPT, type PayMethod } from "@/lib/payments"
import { esc, thermalDocument, type ReceiptWidth } from "@/lib/thermalPrint"

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export interface ReceiptData {
  saleId: string
  date: Date | string
  items: ReceiptItem[]
  subtotal: number
  paymentMethod: "dinheiro" | "pix" | "cartao"
  interest?: number
  total: number
  installments?: number
  installmentValue?: number
  received?: number
  change?: number
  /** Formas de pagamento (pagamento dividido tem mais de uma). */
  payments?: Array<{ method: PayMethod; amount: number; installments?: number; installmentValue?: number }>
}

export interface ReceiptStore {
  name: string
  tagline?: string
  doc?: string
  address?: string
  phone?: string
  footer?: string
}

const METHOD_LABEL: Record<string, string> = { dinheiro: "DINHEIRO", pix: "PIX", cartao: "CARTAO CREDITO" }

function brl(value: unknown): string {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value.replace(",", ".")) || 0
        : value && typeof value === "object" && "toNumber" in value
          ? (value as { toNumber: () => number }).toNumber()
          : 0
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

const linha = (a: string, b: string, cls = "p") => `<div class="linha ${cls}"><span>${a}</span><span>${b}</span></div>`

function pagamentos(d: ReceiptData): string {
  let out = ""
  if (d.payments && d.payments.length > 0) {
    for (const p of d.payments) {
      const parc = p.installments && p.installments > 1
      out += linha(`${esc(PAY_RECEIPT[p.method] ?? p.method)}${parc ? ` ${p.installments}x` : ""}`, brl(p.amount))
      if (parc && p.installmentValue) out += linha("Parcela", `${p.installments}x ${brl(p.installmentValue)}`)
    }
    if (d.payments.some((p) => p.method === "CASH") && typeof d.received === "number" && d.received > 0) {
      out += linha("Recebido dinheiro", brl(d.received)) + linha("Troco", brl(d.change ?? 0))
    }
    return out
  }
  const parc = d.paymentMethod === "cartao" && d.installments && d.installments > 1
  out += linha("Pagamento", `${METHOD_LABEL[d.paymentMethod] ?? esc(d.paymentMethod)}${parc ? ` ${d.installments}x` : ""}`)
  if (parc && d.installmentValue && d.installmentValue > 0) out += linha("Parcela", `${d.installments}x ${brl(d.installmentValue)}`)
  if (d.paymentMethod === "dinheiro" && typeof d.received === "number" && d.received > 0) {
    out += linha("Recebido", brl(d.received)) + linha("Troco", brl(d.change ?? 0))
  }
  return out
}

export function receiptHtml(d: ReceiptData, store: ReceiptStore, width: ReceiptWidth = "80mm"): string {
  const dt = new Date(d.date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const itens = d.items
    .map(
      (it) =>
        `<tr><td colspan="2" class="b">${esc(it.name)}</td></tr>` +
        `<tr><td class="p">${esc(it.quantity)} x ${brl(it.unitPrice)}</td><td class="p num">${brl(it.total)}</td></tr>`,
    )
    .join("")

  const corpo =
    `<div class="c b g quebra">${esc(store.name || "LAÇOLARIA")}</div>` +
    (store.tagline ? `<div class="c p">${esc(store.tagline)}</div>` : "") +
    (store.doc ? `<div class="c p">${esc(store.doc)}</div>` : "") +
    (store.address ? `<div class="c p quebra">${esc(store.address)}</div>` : "") +
    (store.phone ? `<div class="c p">Tel: ${esc(store.phone)}</div>` : "") +
    '<div class="sep"></div>' +
    '<div class="c b">COMPROVANTE DE COMPRA</div>' +
    '<div class="c p">NAO E DOCUMENTO FISCAL</div>' +
    '<div class="sep"></div>' +
    linha("Venda:", esc(d.saleId)) +
    linha("Data:", esc(dt)) +
    '<div class="sep"></div>' +
    '<table><colgroup><col style="width:62%"><col style="width:38%"></colgroup>' +
    `<tbody>${itens}</tbody></table>` +
    '<div class="sep"></div>' +
    linha("Subtotal", brl(d.subtotal), "") +
    (typeof d.interest === "number" && d.interest > 0 ? linha("Juros cartao", brl(d.interest)) : "") +
    linha("TOTAL", brl(d.total), "b g") +
    '<div class="sep"></div>' +
    pagamentos(d) +
    '<div class="sep"></div>' +
    String(store.footer ?? "")
      .split("\n")
      .map((l) => `<div class="c p quebra">${esc(l)}</div>`)
      .join("") +
    '<div class="fim"></div>'

  return thermalDocument(corpo, width, `Comprovante ${esc(d.saleId)}`)
}
