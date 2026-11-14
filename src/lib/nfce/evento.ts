// Evento de cancelamento da NFC-e (tpEvento 110111).
import { dataHoraSefaz, onlyDigits, xmlText } from "@/lib/nfce/format"
import { NFE_NS } from "@/lib/nfce/xmlBuilder"
import type { NfceAmbiente } from "@/lib/nfce/types"

export interface DadosCancelamento {
  ambiente: NfceAmbiente
  cnpj: string
  chave: string
  protocolo: string
  justificativa: string
  quando: Date
  sequencia?: number
}

/** <evento> sem assinatura (a assinatura vai em infEvento). */
export function montarEventoCancelamento(d: DadosCancelamento): string {
  const just = String(d.justificativa ?? "").replace(/\s+/g, " ").trim()
  if (just.length < 15) throw new Error("A justificativa do cancelamento precisa ter pelo menos 15 letras")
  const seq = d.sequencia ?? 1
  const id = `ID110111${d.chave}${String(seq).padStart(2, "0")}`
  return (
    `<evento xmlns="${NFE_NS}" versao="1.00">` +
    `<infEvento Id="${id}">` +
    `<cOrgao>${d.chave.slice(0, 2)}</cOrgao>` +
    `<tpAmb>${d.ambiente}</tpAmb>` +
    `<CNPJ>${onlyDigits(d.cnpj)}</CNPJ>` +
    `<chNFe>${d.chave}</chNFe>` +
    `<dhEvento>${dataHoraSefaz(d.quando)}</dhEvento>` +
    "<tpEvento>110111</tpEvento>" +
    `<nSeqEvento>${seq}</nSeqEvento>` +
    "<verEvento>1.00</verEvento>" +
    '<detEvento versao="1.00">' +
    "<descEvento>Cancelamento</descEvento>" +
    `<nProt>${onlyDigits(d.protocolo)}</nProt>` +
    `<xJust>${xmlText(just, 255)}</xJust>` +
    "</detEvento>" +
    "</infEvento>" +
    "</evento>"
  )
}

export function loteEvento(eventoAssinado: string, idLote: string): string {
  const ev = eventoAssinado.replace(/^<\?xml[^>]*>/, "")
  return `<envEvento xmlns="${NFE_NS}" versao="1.00"><idLote>${idLote}</idLote>${ev}</envEvento>`
}

/** 135 registrado; 155 cancelamento homologado fora do prazo. */
export const eventoRegistrado = (cStat: number) => cStat === 135 || cStat === 155

export function montarProcEvento(eventoAssinado: string, retEvento: string): string {
  const ev = eventoAssinado.replace(/^<\?xml[^>]*>/, "")
  return `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe xmlns="${NFE_NS}" versao="1.00">${ev}${retEvento}</procEventoNFe>`
}
