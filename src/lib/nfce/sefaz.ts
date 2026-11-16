// Comunicação com os webservices da NFC-e da SEFAZ-SP (SOAP 1.2 + certificado A1).
import https from "node:https"
import tls from "node:tls"
import { NFE_NS } from "@/lib/nfce/xmlBuilder"
import { CAS_SEFAZ } from "@/lib/nfce/icpBrasil"
import type { CertificadoA1 } from "@/lib/nfce/certificate"
import type { NfceAmbiente } from "@/lib/nfce/types"

/** portal.fazenda.sp.gov.br/servicos/nfce → WebServices (versão 4.00). */
const HOSTS: Record<NfceAmbiente, string> = {
  1: "https://nfce.fazenda.sp.gov.br/ws",
  2: "https://homologacao.nfce.fazenda.sp.gov.br/ws",
}

export const SERVICOS = {
  autorizacao: { arquivo: "NFeAutorizacao4.asmx", wsdl: "NFeAutorizacao4", metodo: "nfeAutorizacaoLote" },
  retAutorizacao: { arquivo: "NFeRetAutorizacao4.asmx", wsdl: "NFeRetAutorizacao4", metodo: "nfeRetAutorizacaoLote" },
  status: { arquivo: "NFeStatusServico4.asmx", wsdl: "NFeStatusServico4", metodo: "nfeStatusServicoNF" },
  consulta: { arquivo: "NFeConsultaProtocolo4.asmx", wsdl: "NFeConsultaProtocolo4", metodo: "nfeConsultaNF" },
  evento: { arquivo: "NFeRecepcaoEvento4.asmx", wsdl: "NFeRecepcaoEvento4", metodo: "nfeRecepcaoEvento" },
} as const

export type Servico = keyof typeof SERVICOS

export const urlServico = (servico: Servico, ambiente: NfceAmbiente) => `${HOSTS[ambiente]}/${SERVICOS[servico].arquivo}`

export function envelopeSoap(servico: Servico, corpo: string): string {
  const ns = `http://www.portalfiscal.inf.br/nfe/wsdl/${SERVICOS[servico].wsdl}`
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    `<soap12:Body><nfeDadosMsg xmlns="${ns}">${corpo}</nfeDadosMsg></soap12:Body>` +
    "</soap12:Envelope>"
  )
}

/** Erro de comunicação (sem resposta da SEFAZ) — a nota pode ou não ter sido autorizada. */
export class SefazSemResposta extends Error {}

export type Transporte = (url: string, soapAction: string, body: string, cert: CertificadoA1) => Promise<string>

/** Envio HTTPS com o certificado do cliente (o mesmo A1 que assina). */
export const transporteHttps: Transporte = (url, soapAction, body, cert) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        key: cert.keyPem,
        cert: cert.certPem,
        // a SEFAZ-SP usa certificado ICP-Brasil, que não vem na lista padrão do Node
        ca: [...tls.rootCertificates, ...CAS_SEFAZ],
        timeout: 30_000,
        headers: {
          "Content-Type": `application/soap+xml; charset=utf-8; action="${soapAction}"`,
          "Content-Length": Buffer.byteLength(body, "utf8"),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (c: Buffer) => chunks.push(c))
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          if ((res.statusCode ?? 0) >= 400 && !/<soap/i.test(text)) {
            reject(new SefazSemResposta(`SEFAZ respondeu HTTP ${res.statusCode}`))
          } else resolve(text)
        })
      },
    )
    req.on("timeout", () => req.destroy(new SefazSemResposta("A SEFAZ demorou mais de 30 s para responder")))
    req.on("error", (e) => reject(e instanceof SefazSemResposta ? e : new SefazSemResposta(`Sem conexão com a SEFAZ: ${e.message}`)))
    req.end(body, "utf8")
  })

export async function chamarSefaz(
  servico: Servico,
  ambiente: NfceAmbiente,
  corpo: string,
  cert: CertificadoA1,
  transporte: Transporte = transporteHttps,
): Promise<string> {
  const s = SERVICOS[servico]
  const action = `http://www.portalfiscal.inf.br/nfe/wsdl/${s.wsdl}/${s.metodo}`
  return transporte(urlServico(servico, ambiente), action, envelopeSoap(servico, corpo), cert)
}

// ---------------- leitura das respostas ----------------

/** Texto da 1ª ocorrência de <tag> (ignora prefixo de namespace). */
export function tagTexto(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`))
  return m ? m[1].trim() : ""
}

/** Elemento inteiro (com as tags) da 1ª ocorrência. */
export function tagCompleta(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${tag}>`))
  return m ? m[0] : ""
}

export interface Protocolo {
  cStat: number
  xMotivo: string
  nProt: string
  dhRecbto: string
  /** <protNFe> inteiro, para montar o nfeProc. */
  protNFe: string
}

export function lerProtocolo(xml: string): Protocolo | null {
  const prot = tagCompleta(xml, "protNFe")
  if (!prot) return null
  const inf = tagCompleta(prot, "infProt")
  return {
    cStat: Number(tagTexto(inf, "cStat")),
    xMotivo: tagTexto(inf, "xMotivo"),
    nProt: tagTexto(inf, "nProt"),
    dhRecbto: tagTexto(inf, "dhRecbto"),
    protNFe: prot.replace(/<(\/?)\w+:/g, "<$1"),
  }
}

/** 100 autorizada; 150 autorizada fora do prazo. */
export const autorizada = (cStat: number) => cStat === 100 || cStat === 150
/** Uso denegado: o número fica usado e a nota não vale. */
export const denegada = (cStat: number) => [110, 205, 301, 302, 303].includes(cStat)

/** XML de distribuição (o que a loja guarda por 5 anos). */
export function montarNfeProc(nfeAssinada: string, protNFe: string): string {
  const nfe = nfeAssinada.replace(/^<\?xml[^>]*>/, "")
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="${NFE_NS}">${nfe}${protNFe}</nfeProc>`
}

export function loteAutorizacao(nfeAssinada: string, idLote: string): string {
  const nfe = nfeAssinada.replace(/^<\?xml[^>]*>/, "")
  return `<enviNFe xmlns="${NFE_NS}" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfe}</enviNFe>`
}

export const consultaRecibo = (ambiente: NfceAmbiente, nRec: string) =>
  `<consReciNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>${ambiente}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`

export const consultaStatus = (ambiente: NfceAmbiente, cUF = "35") =>
  `<consStatServ xmlns="${NFE_NS}" versao="4.00"><tpAmb>${ambiente}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`

export const consultaChave = (ambiente: NfceAmbiente, chave: string) =>
  `<consSitNFe xmlns="${NFE_NS}" versao="4.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`
