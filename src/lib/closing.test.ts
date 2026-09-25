import { describe, it, expect } from "vitest"
import { computeDifference, computeExpected, differenceLabel, feeAmount, feePercent, feeRatesOf, hasFees, NO_FEES, parseMoney } from "./closing"
import { buildInsights } from "./reportInsights"

const brl = (v: number) => `R$ ${v.toFixed(2)}`

describe("conferência do caixa", () => {
  const report = { net: { cash: 106, card: 89.9, pix: 15 } }

  it("dinheiro esperado = fundo + dinheiro do dia − retiradas", () => {
    expect(computeExpected(report, 50, 20)).toEqual({ expectedCash: 136, expectedCard: 89.9, expectedPix: 15 })
  })

  it("soma só as formas contadas", () => {
    const exp = computeExpected(report, 50, 0)
    expect(computeDifference(exp, { countedCash: 156, countedCard: null, countedPix: null })).toBe(0)
    expect(computeDifference(exp, { countedCash: 150, countedCard: 89.9, countedPix: 14 })).toBe(-7)
  })

  it("rótulos: Bateu / Faltam / Sobram", () => {
    expect(differenceLabel(0.004, brl)).toEqual({ tone: "ok", text: "Bateu" })
    expect(differenceLabel(-7, brl).text).toBe("Faltam R$ 7.00")
    expect(differenceLabel(2.5, brl).tone).toBe("over")
  })

  it("lê valores no formato brasileiro", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56)
    expect(parseMoney("R$ 56,00")).toBe(56)
    expect(parseMoney("12.5")).toBe(12.5)
    expect(parseMoney("")).toBeNull()
    expect(parseMoney("-3")).toBeNull()
    expect(parseMoney("abc")).toBeNull()
  })
})

describe("falas da assistente", () => {
  it("resume o dia", () => {
    const t = buildInsights({
      salesCount: 3,
      revenue: 110.9,
      net: { cash: 6, card: 89.9, pix: 15 },
      netTotal: 110.9,
      byHour: [
        { hour: 10, total: 20 },
        { hour: 15, total: 90.9 },
      ],
      topProducts: [{ name: "Mochila", total: 89.9 }],
      topByQuantity: { name: "Caneta", quantity: 14 },
      last7Avg: 80,
      refunds: { count: 1, total: 12.9 },
    })
    expect(t[0]).toMatch(/^3 vendas/)
    expect(t.join(" ")).toMatch(/Cartão foi a forma mais usada: 81%/)
    expect(t.join(" ")).toMatch(/Melhor horário: das 15h às 16h/)
    expect(t.join(" ")).toMatch(/Mais saiu: Caneta/)
    expect(t.join(" ")).toMatch(/Destaque em valor: Mochila/)
    expect(t.join(" ")).toMatch(/39% acima da média/)
    expect(t.join(" ")).toMatch(/1 venda estornada/)
  })
  it("dia sem vendas", () => {
    const t = buildInsights({
      salesCount: 0, revenue: 0, net: { cash: 0, card: 0, pix: 0 }, netTotal: 0, byHour: [], topProducts: [],
      topByQuantity: null, last7Avg: 0, refunds: { count: 0, total: 0 },
    })
    expect(t).toEqual(["Nenhuma venda registrada neste dia."])
  })
})

describe("taxas da maquininha", () => {
  const rates = { debit: 1.37, credit: 3.15, creditInstallment: 4.99, pix: 0.99 }

  it("escolhe o % pela forma e pelas parcelas", () => {
    expect(feePercent("DEBIT_CARD", 1, rates)).toBe(1.37)
    expect(feePercent("CREDIT_CARD", 1, rates)).toBe(3.15)
    expect(feePercent("CREDIT_CARD", null, rates)).toBe(3.15)
    expect(feePercent("CREDIT_CARD", 3, rates)).toBe(4.99)
    expect(feePercent("PIX", 1, rates)).toBe(0.99)
    expect(feePercent("CASH", 1, rates)).toBe(0)
  })

  it("calcula a taxa em reais, com centavos", () => {
    expect(feeAmount("CREDIT_CARD", 100, 1, rates)).toBe(3.15)
    expect(feeAmount("DEBIT_CARD", 89.9, 1, rates)).toBe(1.23)
    expect(feeAmount("PIX", 15, 1, rates)).toBe(0.15)
    expect(feeAmount("CASH", 50, 1, rates)).toBe(0)
  })

  it("parcelado em branco usa a taxa do crédito à vista", () => {
    expect(feeRatesOf({ feeCreditPercent: 3, feeCreditInstallmentPercent: 0 }).creditInstallment).toBe(3)
    expect(feeRatesOf({ feeCreditPercent: 3, feeCreditInstallmentPercent: 5 }).creditInstallment).toBe(5)
  })

  it("sabe quando não há taxa cadastrada", () => {
    expect(hasFees(NO_FEES)).toBe(false)
    expect(hasFees({ ...NO_FEES, pix: 0.5 })).toBe(true)
  })

  it("a assistente fala das taxas quando existem", () => {
    const t = buildInsights({
      salesCount: 2, revenue: 115, net: { cash: 0, card: 100, pix: 15 }, netTotal: 115, byHour: [], topProducts: [],
      topByQuantity: null, last7Avg: 0, refunds: { count: 0, total: 0 }, feesTotal: 3.3,
    })
    expect(t.join(" ")).toMatch(/Taxas de cartão e Pix/)
  })
})
