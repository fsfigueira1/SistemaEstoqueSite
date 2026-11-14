// Chave de acesso da NF-e/NFC-e (44 dígitos) e dígito verificador (módulo 11).
import { onlyDigits } from "@/lib/nfce/format"

/** Código IBGE das UFs usadas aqui. */
export const CODIGO_UF: Record<string, string> = { SP: "35" }

export function digitoVerificador(chave43: string): number {
  let soma = 0
  let peso = 2
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** Código numérico aleatório de 8 dígitos, diferente do número da nota. */
export function sortearCodigoNumerico(numero: number): string {
  for (;;) {
    const c = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0")
    if (Number(c) !== numero && c !== "00000000") return c
  }
}

export interface PartesChave {
  uf: string
  emissao: Date
  cnpj: string
  modelo?: number
  serie: number
  numero: number
  tpEmis?: number
  codigoNumerico: string
}

export function montarChave(p: PartesChave): { chave: string; dv: number } {
  // AAMM no horário de Brasília
  const local = new Date(p.emissao.getTime() - 3 * 3600_000)
  const aamm = String(local.getUTCFullYear()).slice(2) + String(local.getUTCMonth() + 1).padStart(2, "0")
  const cUF = CODIGO_UF[p.uf] ?? ""
  if (!cUF) throw new Error(`UF ${p.uf} não suportada`)
  const base =
    cUF +
    aamm +
    onlyDigits(p.cnpj).padStart(14, "0") +
    String(p.modelo ?? 65).padStart(2, "0") +
    String(p.serie).padStart(3, "0") +
    String(p.numero).padStart(9, "0") +
    String(p.tpEmis ?? 1) +
    p.codigoNumerico.padStart(8, "0")
  if (base.length !== 43) throw new Error("Chave de acesso com tamanho errado")
  const dv = digitoVerificador(base)
  return { chave: base + dv, dv }
}

/** Chave em grupos de 4 (como sai no DANFE). */
export const chaveFormatada = (chave: string) => chave.replace(/(\d{4})(?=\d)/g, "$1 ")
