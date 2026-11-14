// QR Code e endereço de consulta da NFC-e (DANFE NFC-e) — SEFAZ-SP.
import { createHash } from "node:crypto"
import type { NfceAmbiente, NfceQrConfig } from "@/lib/nfce/types"

/** Endereços de São Paulo (Manual de Padrões Técnicos do DANFE NFC-e e QR-Code). */
export const URLS_SP = {
  qrcode: {
    1: "https://www.nfce.fazenda.sp.gov.br/qrcode",
    2: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode",
  },
  consulta: {
    1: "https://www.nfce.fazenda.sp.gov.br/consulta",
    2: "https://www.homologacao.nfce.fazenda.sp.gov.br/consulta",
  },
} as const

/**
 * Conteúdo do QR Code de uma NFC-e emitida on-line (tpEmis = 1).
 * - versão 2: chave|2|tpAmb|idCSC|hash, hash = SHA-1 (hex maiúsculo) de "chave|2|tpAmb|idCSC" + CSC
 * - versão 3 (NT 2025.001): chave|3|tpAmb, sem CSC
 */
export function montarQrCode(chave: string, ambiente: NfceAmbiente, cfg: NfceQrConfig): string {
  const base = URLS_SP.qrcode[ambiente]
  if (cfg.versao === 3) return `${base}?p=${chave}|3|${ambiente}`
  const idCsc = String(Number(String(cfg.idCsc ?? "").trim()))
  const csc = String(cfg.csc ?? "").trim()
  if (!idCsc || idCsc === "NaN" || idCsc === "0" || !csc) {
    throw new Error("Falta o CSC (código de segurança) e o ID do token da NFC-e nas configurações")
  }
  const params = `${chave}|2|${ambiente}|${idCsc}`
  const hash = createHash("sha1").update(params + csc, "utf8").digest("hex").toUpperCase()
  return `${base}?p=${params}|${hash}`
}

export const urlConsulta = (ambiente: NfceAmbiente) => URLS_SP.consulta[ambiente]

/** Grupo infNFeSupl (vai entre </infNFe> e <Signature>). */
export function grupoInfNFeSupl(qrCode: string, ambiente: NfceAmbiente, versao: 2 | 3): string {
  const qr = versao === 2 ? `<![CDATA[${qrCode}]]>` : qrCode
  return `<infNFeSupl><qrCode>${qr}</qrCode><urlChave>${urlConsulta(ambiente)}</urlChave></infNFeSupl>`
}
