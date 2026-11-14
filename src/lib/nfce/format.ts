// Formatação dos campos do XML da NFC-e (sem banco, sem rede).

export const onlyDigits = (s: string | undefined | null) => String(s ?? "").replace(/\D/g, "")

/** Valor com casas fixas e ponto (ex.: 12.5 -> "12.50"). */
export function dec(n: number, casas = 2): string {
  const f = 10 ** casas
  const v = Math.round((n + Number.EPSILON) * f) / f
  return v.toFixed(casas)
}

/** Centavos inteiros (evita erro de ponto flutuante nas somas). */
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100)

/**
 * Texto seguro para o XML (a NFC-e aceita UTF-8, então os acentos ficam):
 * tira caracteres de controle e espaços duplicados e escapa &, <, >, " e '.
 */
export function xmlText(s: string | undefined | null, max?: number): string {
  let t = Array.from(String(s ?? ""), (ch) => {
    const c = ch.charCodeAt(0)
    return c < 32 || c === 127 ? " " : ch // caracteres de controle viram espaço
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
  if (max && t.length > max) t = t.slice(0, max).trim()
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Data/hora no fuso de Brasília (UTC-3, sem horário de verão desde 2019),
 * no formato da SEFAZ: AAAA-MM-DDThh:mm:ss-03:00.
 */
export function dataHoraSefaz(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3600_000)
  const iso = local.toISOString().slice(0, 19)
  return `${iso}-03:00`
}

/** Tag com conteúdo; some quando o valor é vazio. */
export function tagOpt(name: string, value: string | undefined | null): string {
  return value ? `<${name}>${value}</${name}>` : ""
}

/** Valida CPF (11 dígitos) pelos dígitos verificadores. */
export function cpfValido(cpf: string): boolean {
  const c = onlyDigits(cpf)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  const dv = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10])
}

/** Valida CNPJ (14 dígitos) pelos dígitos verificadores. */
export function cnpjValido(cnpj: string): boolean {
  const c = onlyDigits(cnpj)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const dv = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13])
}
