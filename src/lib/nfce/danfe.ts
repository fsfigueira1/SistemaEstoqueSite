// DANFE NFC-e para bobina de 80 mm (Manual de Padrões Técnicos do DANFE NFC-e e QR Code).
// Montado a partir do XML guardado (nfeProc), então a 2ª via sai igual à 1ª.
import QRCode from "qrcode"
import { chaveFormatada } from "@/lib/nfce/chave"
import { tagCompleta, tagTexto } from "@/lib/nfce/sefaz"
import { esc, thermalDocument, type ReceiptWidth } from "@/lib/thermalPrint"

const PAGAMENTOS: Record<string, string> = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão de Crédito",
  "04": "Cartão de Débito",
  "05": "Crédito Loja",
  "10": "Vale Alimentação",
  "11": "Vale Refeição",
  "12": "Vale Presente",
  "13": "Vale Combustível",
  "15": "Boleto Bancário",
  "16": "Depósito Bancário",
  "17": "PIX",
  "18": "Transferência",
  "19": "Fidelidade/Cashback",
  "90": "Sem pagamento",
  "99": "Outros",
}

const brl = (v: string | number) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const qtd = (v: string) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })

const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
const cpfFmt = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")

/** "2026-11-14T10:30:00-03:00" -> "14/11/2026 10:30:00" */
const dataBr = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : s
}

export interface DanfeOpcoes {
  width?: ReceiptWidth
  /** Nota cancelada: imprime o aviso no topo. */
  cancelada?: boolean
  /** "2ª via" etc. */
  via?: string
}

export async function montarDanfeHtml(nfeProc: string, op: DanfeOpcoes = {}): Promise<string> {
  const inf = tagCompleta(nfeProc, "infNFe")
  const emit = tagCompleta(inf, "emit")
  const ender = tagCompleta(emit, "enderEmit")
  const ide = tagCompleta(inf, "ide")
  const dest = tagCompleta(inf, "dest")
  const tot = tagCompleta(inf, "ICMSTot")
  const prot = tagCompleta(nfeProc, "infProt")
  const chave = (inf.match(/Id="NFe(\d{44})"/) ?? [])[1] ?? ""
  const qrCode = tagTexto(nfeProc, "qrCode").replace(/^<!\[CDATA\[|\]\]>$/g, "")
  const urlChave = tagTexto(nfeProc, "urlChave")
  const homolog = tagTexto(ide, "tpAmb") === "2"

  const dets = [...inf.matchAll(/<det nItem="\d+">([\s\S]*?)<\/det>/g)].map((m) => tagCompleta(m[1], "prod"))
  const pags = [...inf.matchAll(/<detPag>([\s\S]*?)<\/detPag>/g)].map((m) => ({
    tPag: tagTexto(m[1], "tPag"),
    vPag: tagTexto(m[1], "vPag"),
  }))
  const vTroco = tagTexto(tagCompleta(inf, "pag"), "vTroco")
  const vDesc = Number(tagTexto(tot, "vDesc") || 0)
  const vOutro = Number(tagTexto(tot, "vOutro") || 0)
  const infCpl = tagTexto(tagCompleta(inf, "infAdic"), "infCpl")

  const svg = qrCode
    ? await QRCode.toString(qrCode, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#ffffff" } })
    : ""

  const docDest = tagTexto(dest, "CPF") || tagTexto(dest, "CNPJ")
  const consumidor = docDest
    ? `CONSUMIDOR - ${docDest.length === 11 ? "CPF " + cpfFmt(docDest) : "CNPJ " + cnpjFmt(docDest)}${tagTexto(dest, "xNome") ? " - " + esc(tagTexto(dest, "xNome")) : ""}`
    : "CONSUMIDOR NÃO IDENTIFICADO"

  const endereco = [
    tagTexto(ender, "xLgr"),
    tagTexto(ender, "nro"),
    tagTexto(ender, "xCpl"),
    tagTexto(ender, "xBairro"),
    `${tagTexto(ender, "xMun")}-${tagTexto(ender, "UF")}`,
  ]
    .filter(Boolean)
    .join(", ")

  const itens = dets
    .map((p) => {
      return (
        "<tr>" +
        `<td colspan="4" class="b">${esc(tagTexto(p, "cProd"))} ${esc(tagTexto(p, "xProd"))}</td>` +
        "</tr><tr>" +
        `<td>${qtd(tagTexto(p, "qCom"))} ${esc(tagTexto(p, "uCom"))}</td>` +
        `<td class="num">x ${brl(tagTexto(p, "vUnCom"))}</td>` +
        `<td></td>` +
        `<td class="num">${brl(tagTexto(p, "vProd"))}</td>` +
        "</tr>"
      )
    })
    .join("")

  const aviso = (t: string) => `<div class="c b">${t}</div>`

  const corpo =
    (op.cancelada ? aviso("*** NFC-e CANCELADA ***") + '<div class="sep"></div>' : "") +
    // Divisão I — emitente
    `<div class="c b quebra">${esc(tagTexto(emit, "xNome"))}</div>` +
    `<div class="c p">CNPJ ${cnpjFmt(tagTexto(emit, "CNPJ"))} &nbsp; IE ${esc(tagTexto(emit, "IE"))}</div>` +
    `<div class="c p quebra">${esc(endereco)}</div>` +
    '<div class="sep"></div>' +
    // Divisão II
    '<div class="c b p">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>' +
    (homolog ? aviso("EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL") : "") +
    '<div class="sep"></div>' +
    // Divisão III — itens
    '<table class="p"><colgroup><col style="width:34%"><col style="width:30%"><col style="width:6%"><col style="width:30%"></colgroup>' +
    '<thead><tr><th colspan="2">Código Descrição</th><th></th><th class="num">Vl Total</th></tr></thead>' +
    `<tbody>${itens}</tbody></table>` +
    '<div class="sep"></div>' +
    // Divisão IV — totais
    `<div class="linha p"><span>Qtde. total de itens</span><span>${dets.length}</span></div>` +
    `<div class="linha p"><span>Valor total R$</span><span>${brl(tagTexto(tot, "vProd"))}</span></div>` +
    (vDesc > 0 ? `<div class="linha p"><span>Desconto R$</span><span>-${brl(vDesc)}</span></div>` : "") +
    (vOutro > 0 ? `<div class="linha p"><span>Acréscimos R$</span><span>${brl(vOutro)}</span></div>` : "") +
    `<div class="linha b"><span>Valor a pagar R$</span><span>${brl(tagTexto(tot, "vNF"))}</span></div>` +
    '<div class="linha p b"><span>FORMA PAGAMENTO</span><span>VALOR PAGO R$</span></div>' +
    pags
      .map((p) => `<div class="linha p"><span>${esc(PAGAMENTOS[p.tPag] ?? p.tPag)}</span><span>${brl(p.vPag)}</span></div>`)
      .join("") +
    (Number(vTroco) > 0 ? `<div class="linha p"><span>Troco R$</span><span>${brl(vTroco)}</span></div>` : "") +
    '<div class="sep"></div>' +
    // Divisão V — consulta pela chave
    '<div class="c p b">Consulte pela Chave de Acesso em</div>' +
    `<div class="c p quebra">${esc(urlChave)}</div>` +
    `<div class="c p">${chaveFormatada(chave)}</div>` +
    '<div class="sep"></div>' +
    // Divisão VI — consumidor
    `<div class="c p b quebra">${consumidor}</div>` +
    '<div class="sep"></div>' +
    // Divisão VII — identificação e protocolo
    `<div class="c p b">NFC-e nº ${tagTexto(ide, "nNF").padStart(9, "0")} Série ${tagTexto(ide, "serie").padStart(3, "0")} ${dataBr(tagTexto(ide, "dhEmi"))}</div>` +
    (prot
      ? `<div class="c p"><span class="b">Protocolo de autorização:</span> ${esc(tagTexto(prot, "nProt"))}</div>` +
        `<div class="c p"><span class="b">Data de autorização:</span> ${dataBr(tagTexto(prot, "dhRecbto"))}</div>`
      : aviso("NOTA SEM AUTORIZAÇÃO - NÃO VALE COMO DOCUMENTO FISCAL")) +
    (op.via ? `<div class="c p">${esc(op.via)}</div>` : "") +
    // Divisão VIII — QR Code
    (svg ? `<div class="qr" style="width:32mm;height:32mm">${svg}</div>` : "") +
    // Divisão IX — informações
    (infCpl ? `<div class="sep"></div><div class="c p quebra">${esc(infCpl)}</div>` : "") +
    (homolog ? '<div class="sep"></div>' + aviso("SEM VALOR FISCAL") : "") +
    '<div class="fim"></div>'

  return thermalDocument(corpo, op.width ?? "80mm", `NFC-e ${tagTexto(ide, "nNF")}`)
}
