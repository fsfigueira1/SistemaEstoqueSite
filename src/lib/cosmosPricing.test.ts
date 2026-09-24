import { describe, it, expect } from "vitest"
import { adviceFromGtin, adviceFromSearch, cosmosAvg, prettyName } from "./cosmosPricing"

// Resposta real de exemplo da documentação do Cosmos (GET /gtins/7891910000197.json)
const acucar = {
  avg_price: 2.99,
  brand: { name: "UNIÃO", picture: "" },
  description: "AÇÚCAR REFINADO UNIÃO 1KG",
  gtin: 7891910000197,
  price: "R$ 2,99",
  thumbnail: "",
}

describe("Cosmos: preço pelo código de barras", () => {
  it("usa o preço médio + toque da loja, com final ,90", () => {
    const a = adviceFromGtin({ ...acucar, avg_price: 12, min_price: 9.9, max_price: 15 }, { markupPct: 10 })
    expect(a.provider).toBe("cosmos")
    expect(a.productName).toBe("Açúcar Refinado União 1kg")
    expect(a.brand).toBe("UNIÃO")
    expect(a.market).toEqual({ min: 9.9, median: 12, max: 15 })
    expect(a.suggested).toBe(13.9) // 12 × 1,10 = 13,20 → 13,90
    expect(a.range).toEqual({ min: 12.9, max: 15.9 })
    expect(a.confidence).toBe("alta")
    expect(a.direction).toMatch(/Preço médio no Brasil: R\$\s12,00 \(de R\$\s9,90 a R\$\s15,00\)/)
    expect(a.sources[0].url).toBe("https://cosmos.bluesoft.com.br/produtos/7891910000197")
  })

  it("sem toque da loja fica no preço médio arredondado", () => {
    expect(adviceFromGtin(acucar, { markupPct: 0 }).suggested).toBe(3.5) // 2,99 → 3,50
  })

  it("respeita custo + 30%", () => {
    const a = adviceFromGtin({ ...acucar, avg_price: 5 }, { markupPct: 10, costPrice: 5 })
    expect(a.suggested).toBe(6.5) // 5 × 1,3 = 6,50
    expect(a.marginPct).toBe(23)
    expect(a.direction).toMatch(/margem mínima/)
  })

  it("lê o preço em texto quando não há avg_price", () => {
    expect(cosmosAvg({ price: "R$ 1.234,56" })).toBe(1234.56)
    expect(cosmosAvg({ avg_price: "3.5" })).toBe(3.5)
    expect(cosmosAvg({})).toBeNull()
  })

  it("produto sem preço na base: usa o custo × 2", () => {
    const a = adviceFromGtin({ description: "Caderno X", gtin: 1 }, { markupPct: 10, costPrice: 8 })
    expect(a.found).toBe(true)
    expect(a.market.median).toBeNull()
    expect(a.suggested).toBe(16.9)
    expect(a.confidence).toBe("baixa")
  })

  it("código fora da base", () => {
    const a = adviceFromGtin(null, { markupPct: 10 })
    expect(a.found).toBe(false)
    expect(a.suggested).toBeNull()
    expect(a.direction).toMatch(/não encontrado/)
  })

  it("aviso de mercado acima do preço atual", () => {
    expect(adviceFromGtin({ ...acucar, avg_price: 12 }, { markupPct: 10, currentPrice: 10 }).marketAbovePct).toBe(20)
  })
})

describe("Cosmos: busca por nome", () => {
  it("usa a mediana dos parecidos", () => {
    const items = [
      { description: "Caneta BIC Azul", gtin: 1, avg_price: 2 },
      { description: "Caneta BIC Preta", gtin: 2, avg_price: 2.5 },
      { description: "Caneta BIC Vermelha", gtin: 3, avg_price: 3 },
      { description: "Sem preço", gtin: 4 },
    ]
    const a = adviceFromSearch(items, { markupPct: 10 })
    expect(a.sources).toHaveLength(3)
    expect(a.market).toEqual({ min: 2, median: 2.5, max: 3 })
    expect(a.suggested).toBe(2.9) // 2,50 × 1,10 = 2,75 → 2,90
    expect(a.productName).toBeNull()
    expect(a.confidence).toBe("media")
  })

  it("nada encontrado", () => {
    const a = adviceFromSearch([], { markupPct: 10 })
    expect(a.found).toBe(false)
    expect(a.direction).toMatch(/Nenhum produto parecido/)
  })
})

describe("prettyName", () => {
  it("tira o CAIXA ALTA do Cosmos", () => {
    expect(prettyName("CADERNO UNIVERSITARIO TILIBRA 10 MATERIAS 160 FOLHAS")).toBe("Caderno Universitario Tilibra 10 Materias 160 Folhas")
    expect(prettyName("CANETA ESFEROGRAFICA DE GEL COM 12 CORES")).toBe("Caneta Esferografica de Gel com 12 Cores")
  })
  it("mantém nome que já está em caixa mista", () => {
    expect(prettyName("Caneta BIC Cristal")).toBe("Caneta BIC Cristal")
  })
})
