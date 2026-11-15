// Configuração fiscal da NFC-e (guardada em Settings.nfceConfig como JSON;
// o CSC fica à parte em Settings.nfceCsc e nunca vai para o navegador).
import { cnpjValido, onlyDigits } from "@/lib/nfce/format"
import type { Crt, Csosn, NfceAmbiente, NfceEmitente } from "@/lib/nfce/types"

export interface NfceConfig {
  /** Liga a emissão (botão "Emitir NFC-e" no PDV). */
  enabled: boolean
  ambiente: NfceAmbiente
  serie: number
  /** Primeiro número a usar (quando já emitia NFC-e em outro sistema). */
  numeroInicial: number
  emitente: NfceEmitente
  /** ID do token do CSC (ex.: "000001"). */
  idCsc: string
  qrVersao: 2 | 3
  cfopPadrao: string
  csosnPadrao: Csosn
  /** NCM usado quando o produto não tem NCM cadastrado. */
  ncmPadrao: string
  origemPadrao: number
  /** Texto no rodapé da nota (ex.: tributos aproximados, Lei 12.741). */
  informacoesComplementares: string
  respTecCnpj: string
  respTecContato: string
  respTecEmail: string
  respTecFone: string
}

export const CONFIG_PADRAO: NfceConfig = {
  enabled: false,
  ambiente: 2,
  serie: 1,
  numeroInicial: 1,
  emitente: {
    cnpj: "",
    ie: "",
    razaoSocial: "",
    nomeFantasia: "",
    crt: 1,
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cMun: "",
    municipio: "",
    uf: "SP",
    cep: "",
    fone: "",
  },
  idCsc: "",
  qrVersao: 2,
  cfopPadrao: "5102",
  csosnPadrao: "102",
  ncmPadrao: "",
  origemPadrao: 0,
  informacoesComplementares: "",
  respTecCnpj: "",
  respTecContato: "",
  respTecEmail: "",
  respTecFone: "",
}

const CSOSN_OK: Csosn[] = ["102", "103", "300", "400", "500"]
const CRT_OK: Crt[] = [1, 2, 3, 4]

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const int = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao
}

/** Lê o JSON salvo (ou o que veio do formulário) e devolve uma configuração completa e limpa. */
export function normalizarConfig(raw: unknown): NfceConfig {
  let o: Record<string, unknown> = {}
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw || "{}")
    } catch {
      o = {}
    }
  } else if (raw && typeof raw === "object") o = raw as Record<string, unknown>
  const e = (o.emitente && typeof o.emitente === "object" ? o.emitente : {}) as Record<string, unknown>
  const p = CONFIG_PADRAO
  const crt = Number(e.crt) as Crt
  const csosn = String(o.csosnPadrao ?? "") as Csosn
  return {
    enabled: o.enabled === true,
    ambiente: Number(o.ambiente) === 1 ? 1 : 2,
    serie: int(o.serie, 0, 999, p.serie),
    numeroInicial: int(o.numeroInicial, 1, 999_999_999, p.numeroInicial),
    emitente: {
      cnpj: onlyDigits(str(e.cnpj)),
      ie: onlyDigits(str(e.ie)),
      razaoSocial: str(e.razaoSocial, 60),
      nomeFantasia: str(e.nomeFantasia, 60),
      crt: CRT_OK.includes(crt) ? crt : 1,
      logradouro: str(e.logradouro, 60),
      numero: str(e.numero, 60),
      complemento: str(e.complemento, 60),
      bairro: str(e.bairro, 60),
      cMun: onlyDigits(str(e.cMun)),
      municipio: str(e.municipio, 60),
      uf: "SP",
      cep: onlyDigits(str(e.cep)),
      fone: onlyDigits(str(e.fone)),
    },
    idCsc: onlyDigits(str(o.idCsc)),
    qrVersao: Number(o.qrVersao) === 3 ? 3 : 2,
    cfopPadrao: onlyDigits(str(o.cfopPadrao)) || p.cfopPadrao,
    csosnPadrao: CSOSN_OK.includes(csosn) ? csosn : p.csosnPadrao,
    ncmPadrao: onlyDigits(str(o.ncmPadrao)),
    origemPadrao: int(o.origemPadrao, 0, 8, 0),
    informacoesComplementares: str(o.informacoesComplementares, 500),
    respTecCnpj: onlyDigits(str(o.respTecCnpj)),
    respTecContato: str(o.respTecContato, 60),
    respTecEmail: str(o.respTecEmail, 60),
    respTecFone: onlyDigits(str(o.respTecFone)),
  }
}

/** O que falta para conseguir emitir (lista vazia = pronto). */
export function problemasConfig(c: NfceConfig, temCsc: boolean): string[] {
  const p: string[] = []
  const e = c.emitente
  if (!cnpjValido(e.cnpj)) p.push("CNPJ da empresa")
  if (e.ie.length < 8) p.push("Inscrição estadual")
  if (!e.razaoSocial) p.push("Razão social")
  if (!e.logradouro || !e.numero || !e.bairro) p.push("Endereço (rua, número e bairro)")
  if (e.cMun.length !== 7 || !e.cMun.startsWith("35")) p.push("Código IBGE do município (7 dígitos, começa com 35)")
  if (!e.municipio) p.push("Município")
  if (e.cep.length !== 8) p.push("CEP")
  if (c.qrVersao === 2 && (!c.idCsc || !temCsc)) p.push("CSC e ID do token (gerados no site da SEFAZ)")
  if (c.ncmPadrao && c.ncmPadrao.length !== 8) p.push("NCM padrão (8 dígitos)")
  if (c.cfopPadrao.length !== 4) p.push("CFOP padrão")
  if (c.ambiente === 1 && c.respTecCnpj && !cnpjValido(c.respTecCnpj)) p.push("CNPJ do responsável técnico")
  return p
}
