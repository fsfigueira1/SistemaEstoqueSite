import { describe, it, expect } from "vitest"
import { planPayments, toCheckoutPayments } from "./payments"

const cfg = { cardInterestPercent: 3.5, cardInterestFromInstallments: 2 }

describe("pagamento no PDV", () => {
  it("uma forma só: igual a antes", () => {
    const p = planPayments(100, [{ method: "PIX" }], cfg)
    expect(p.total).toBe(100)
    expect(p.parts).toHaveLength(1)
    expect(p.parts[0]).toMatchObject({ method: "PIX", amount: 100 })
    expect(p.error).toBeNull()
  })

  it("crédito parcelado cobra juros; à vista e débito não", () => {
    expect(planPayments(100, [{ method: "CREDIT_CARD", installments: 3 }], cfg)).toMatchObject({ interest: 3.5, total: 103.5 })
    expect(planPayments(100, [{ method: "CREDIT_CARD", installments: 1 }], cfg).total).toBe(100)
    expect(planPayments(100, [{ method: "DEBIT_CARD" }], cfg).total).toBe(100)
    expect(planPayments(100, [{ method: "CREDIT_CARD", installments: 3 }], cfg).parts[0].installmentValue).toBe(34.5)
  })

  it("dividido: parte em dinheiro, o resto no Pix", () => {
    const p = planPayments(82.4, [{ method: "CASH", amount: 50 }, { method: "PIX" }], cfg, 100)
    expect(p.parts.map((x) => [x.method, x.amount])).toEqual([
      ["CASH", 50],
      ["PIX", 32.4],
    ])
    expect(p.total).toBe(82.4)
    expect(p.change).toBe(50)
    expect(toCheckoutPayments(p)).toEqual([
      { method: "CASH", amount: 50, installments: 1 },
      { method: "PIX", amount: 32.4, installments: 1 },
    ])
  })

  it("dividido com crédito parcelado: juros só na parte do cartão", () => {
    const p = planPayments(200, [{ method: "CASH", amount: 100 }, { method: "CREDIT_CARD", installments: 2 }], cfg)
    expect(p.interest).toBe(3.5)
    expect(p.total).toBe(203.5)
    expect(p.parts[1]).toMatchObject({ base: 100, amount: 103.5, installmentValue: 51.75 })
  })

  it("avisa quando as partes não fecham", () => {
    expect(planPayments(50, [{ method: "CASH", amount: 60 }, { method: "PIX" }], cfg).error).toMatch(/já somam o total/)
    expect(planPayments(50, [{ method: "CASH", amount: 0 }, { method: "PIX" }], cfg).error).toMatch(/valor de cada parte/)
    expect(planPayments(50, [{ method: "CASH" }], cfg, 20).error).toMatch(/recebido menor/)
  })
})
