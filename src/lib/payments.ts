// Pagamento no PDV — uma forma só ou dividido (ex.: parte em dinheiro, o resto
// no Pix). Regra pura, usada na tela e testada em payments.test.ts.
//
//  - Cada parte tem um valor "sem juros". A última parte fica com o restante.
//  - Juros do cartão (Configurações) só entram na parte de crédito parcelado,
//    a partir do nº de parcelas configurado, sobre o valor daquela parte.
//  - Troco: só da parte em dinheiro (recebido − parte em dinheiro).

export type PayMethod = "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD"

export const PAY_LABEL: Record<PayMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
}

/** Nome no comprovante térmico (sem acento). */
export const PAY_RECEIPT: Record<PayMethod, string> = {
  CASH: "DINHEIRO",
  PIX: "PIX",
  DEBIT_CARD: "CARTAO DEBITO",
  CREDIT_CARD: "CARTAO CREDITO",
}

export type PartInput = {
  method: PayMethod
  /** Valor digitado (sem juros). Ignorado na última parte (fica o restante). */
  amount?: number | null
  installments?: number
}

export type PlannedPart = {
  method: PayMethod
  /** Valor sem juros. */
  base: number
  interest: number
  /** O que o cliente paga nessa forma (base + juros). */
  amount: number
  installments: number
  installmentValue: number
}

export type PaymentPlan = {
  parts: PlannedPart[]
  interest: number
  total: number
  cashPart: number
  change: number
  error: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function planPayments(
  subtotal: number,
  inputs: PartInput[],
  cfg: { cardInterestPercent: number; cardInterestFromInstallments: number },
  cashReceived?: number | null,
): PaymentPlan {
  const list = inputs.length ? inputs : [{ method: "CASH" as PayMethod }]
  let error: string | null = null
  let used = 0
  const parts: PlannedPart[] = list.map((p, i) => {
    const last = i === list.length - 1
    let base = last ? r2(subtotal - used) : r2(Math.max(0, Number(p.amount) || 0))
    if (!last) used = r2(used + base)
    if (base < 0) base = 0
    const installments = p.method === "CREDIT_CARD" ? Math.max(1, Math.round(p.installments ?? 1)) : 1
    const from = cfg.cardInterestFromInstallments || 2
    const interest =
      p.method === "CREDIT_CARD" && installments >= from ? r2((base * (cfg.cardInterestPercent || 0)) / 100) : 0
    const amount = r2(base + interest)
    return { method: p.method, base, interest, amount, installments, installmentValue: installments > 1 ? r2(amount / installments) : 0 }
  })

  if (list.length > 1) {
    if (used >= subtotal - 0.004) error = "As partes já somam o total — tire uma forma de pagamento"
    else if (parts.slice(0, -1).some((p) => p.base <= 0)) error = "Digite o valor de cada parte"
  }

  const interest = r2(parts.reduce((s, p) => s + p.interest, 0))
  const total = r2(subtotal + interest)
  const cashPart = r2(parts.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0))
  const received = Number(cashReceived) || 0
  let change = 0
  if (received > 0 && cashPart > 0) {
    if (received < cashPart - 0.004) error ??= "Valor recebido menor que a parte em dinheiro"
    else change = r2(received - cashPart)
  }
  return { parts, interest, total, cashPart, change, error }
}

/** O que vai para o servidor (/api/sales/checkout → payments). */
export function toCheckoutPayments(plan: PaymentPlan) {
  return plan.parts
    .filter((p) => p.amount > 0)
    .map((p) => ({
      method: p.method,
      amount: p.amount,
      installments: p.method === "CREDIT_CARD" ? p.installments : 1,
    }))
}
