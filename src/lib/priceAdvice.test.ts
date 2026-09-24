import { describe, it, expect } from "vitest"
import { extractJson, normalizeAdvice, shelfPriceAtLeast, isValidGtin } from "./priceAdvice"

describe("extractJson", () => {
  it("lê bloco ```json no meio do texto", () => {
    const t = 'Pesquisei.\n```json\n{"a": 1, "b": {"c": 2}}\n```\nPronto.'
    expect(extractJson(t)).toEqual({ a: 1, b: { c: 2 } })
  })
  it("lê o último objeto quando não há bloco", () => {
    expect(extractJson('texto {"x":1} mais {"y":{"z":2}} fim')).toEqual({ y: { z: 2 } })
  })
  it("devolve null quando não há JSON", () => {
    expect(extractJson("sem json aqui")).toBeNull()
  })
})

describe("shelfPriceAtLeast", () => {
  it("arredonda para cima com final ,90", () => {
    expect(shelfPriceAtLeast(13)).toBe(13.9)
    expect(shelfPriceAtLeast(13.9)).toBe(13.9)
    expect(shelfPriceAtLeast(13.95)).toBe(14.9)
    expect(shelfPriceAtLeast(14.9)).toBe(14.9)
    expect(shelfPriceAtLeast(0.42)).toBe(0.45)
  })
})

describe("isValidGtin", () => {
  it("valida dígito verificador", () => {
    expect(isValidGtin("7891000123454")).toBe(true)
    expect(isValidGtin("78935242")).toBe(true)
    expect(isValidGtin("7891000123457")).toBe(false)
    expect(isValidGtin("12345")).toBe(false)
  })
})

describe("normalizeAdvice", () => {
  const raw = {
    produto: { nome: "Caneta BIC Cristal Azul", marca: "BIC", encontrado: true },
    precos: [
      { loja: "Kalunga", preco: 2.5, tipo: "fisica", url: "https://kalunga.com.br/x" },
      { loja: "Papelaria X", preco: "R$ 3,00", tipo: "fisica" },
      { loja: "Loja Online", preco: 1.99, tipo: "online", url: "javascript:alert(1)" },
      { loja: "", preco: 9 },
    ],
    mercado: { minimo: 1, mediana: 99, maximo: 100 },
    sugestao: { preco: 3.9, faixaMin: 2.9, faixaMax: 3.5 },
    direcao: "Pode cobrar um pouco acima da média.",
    confianca: "alta",
  }

  it("recalcula o mercado pelos preços achados e limpa links", () => {
    const a = normalizeAdvice(raw, {})
    expect(a.sources).toHaveLength(3)
    expect(a.sources[2].url).toBeNull()
    expect(a.market).toEqual({ min: 1.99, median: 2.5, max: 3 })
  })

  it("mantém a sugestão dentro da faixa", () => {
    expect(normalizeAdvice(raw, {}).suggested).toBe(3.5)
  })

  it("nunca sugere abaixo de custo + 30%", () => {
    const a = normalizeAdvice(raw, { costPrice: 3 })
    expect(a.suggested).toBe(3.9)
    expect(a.marginPct).toBe(23)
    expect(a.direction).toMatch(/margem mínima/)
  })

  it("calcula quanto o mercado está acima do preço atual", () => {
    expect(normalizeAdvice(raw, { currentPrice: 2 }).marketAbovePct).toBe(25)
  })

  it("aguenta resposta vazia", () => {
    const a = normalizeAdvice(null, {})
    expect(a.suggested).toBeNull()
    expect(a.confidence).toBe("baixa")
    expect(a.sources).toEqual([])
  })
})
