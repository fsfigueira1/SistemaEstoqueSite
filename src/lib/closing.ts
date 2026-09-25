// Contas da conferência do caixa — usadas no servidor (ao salvar) e na tela
// (para mostrar a diferença enquanto a pessoa digita). Sem acesso a banco.

export type MethodKey = "cash" | "card" | "pix"
export type MethodTotals = Record<MethodKey, number>

export const METHOD_LABEL: Record<MethodKey, string> = {
  cash: "Dinheiro",
  card: "Cartão",
  pix: "Pix",
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export type Expected = { expectedCash: number; expectedCard: number; expectedPix: number }
export type Counted = { countedCash: number | null; countedCard: number | null; countedPix: number | null }

/** Dinheiro esperado = fundo de troco + dinheiro líquido do dia − retiradas. */
export function computeExpected(report: { net: MethodTotals }, cashFloat: number, withdrawals: number): Expected {
  return {
    expectedCash: round2(cashFloat + report.net.cash - withdrawals),
    expectedCard: round2(report.net.card),
    expectedPix: round2(report.net.pix),
  }
}

/** Diferença total (contado − esperado), só das formas que foram contadas. */
export function computeDifference(expected: Expected, counted: Counted): number {
  let diff = 0
  if (counted.countedCash != null) diff += counted.countedCash - expected.expectedCash
  if (counted.countedCard != null) diff += counted.countedCard - expected.expectedCard
  if (counted.countedPix != null) diff += counted.countedPix - expected.expectedPix
  return round2(diff)
}

/** "Bateu", "Faltam R$ X" ou "Sobram R$ X" — com tolerância de 1 centavo. */
export function differenceLabel(diff: number, brl: (v: number) => string): { tone: "ok" | "short" | "over"; text: string } {
  if (Math.abs(diff) < 0.01) return { tone: "ok", text: "Bateu" }
  return diff < 0 ? { tone: "short", text: `Faltam ${brl(-diff)}` } : { tone: "over", text: `Sobram ${brl(diff)}` }
}

/** Lê valores digitados no formato brasileiro ("1.234,56") ou com ponto. */
export function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? round2(v) : null
  const s = String(v).trim().replace(/^R\$\s*/i, "")
  if (!s) return null
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s)
  if (!Number.isFinite(n) || n < 0) return null
  return round2(n)
}

// ---------- taxas da maquininha / Pix ----------
export type FeeRates = {
  debit: number
  credit: number
  /** crédito parcelado (2x ou mais) */
  creditInstallment: number
  pix: number
}

export const NO_FEES: FeeRates = { debit: 0, credit: 0, creditInstallment: 0, pix: 0 }

export function hasFees(r: FeeRates): boolean {
  return r.debit > 0 || r.credit > 0 || r.creditInstallment > 0 || r.pix > 0
}

/** % de taxa de um pagamento (dinheiro não tem taxa). */
export function feePercent(method: string, installments: number | null | undefined, r: FeeRates): number {
  switch (method) {
    case "DEBIT_CARD":
      return r.debit
    case "CREDIT_CARD":
      return (installments ?? 1) > 1 ? r.creditInstallment : r.credit
    case "PIX":
      return r.pix
    default:
      return 0
  }
}

/** Valor da taxa de um pagamento, em reais. */
export function feeAmount(method: string, amount: number, installments: number | null | undefined, r: FeeRates): number {
  return round2((amount * feePercent(method, installments, r)) / 100)
}

/** Taxas configuradas (Configurações → Taxas da maquininha). */
export function feeRatesOf(s: {
  feeDebitPercent?: number | null
  feeCreditPercent?: number | null
  feeCreditInstallmentPercent?: number | null
  feePixPercent?: number | null
}): FeeRates {
  return {
    debit: s.feeDebitPercent ?? 0,
    credit: s.feeCreditPercent ?? 0,
    // parcelado em branco (0) = usa a taxa do crédito à vista
    creditInstallment: s.feeCreditInstallmentPercent || s.feeCreditPercent || 0,
    pix: s.feePixPercent ?? 0,
  }
}
