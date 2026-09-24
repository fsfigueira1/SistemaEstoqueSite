import { describe, it, expect } from "vitest"
import { adviceFromOffers, offersFromSerp, prettyName, type SerpShoppingItem } from "./shoppingPricing"

// Formato de `shopping_results` da SerpApi (Google Shopping, gl=br)
const caderno: SerpShoppingItem[] = [
  { title: "Caderno Universitário Tilibra 10 Matérias 160 Folhas", source: "Kalunga", price: "R$ 32,90", extracted_price: 32.9, product_link: "https://google.com/p/1", extensions: ["Retirada na loja"] },
  { title: "Caderno Tilibra 10 matérias", source: "Amazon.com.br", price: "R$ 27,99", extracted_price: 27.99, product_link: "https://google.com/p/2" },
  { title: "Caderno Universitário Tilibra 160fls", source: "Magalu", price: "R$ 29,90", extracted_price: 29.9 },
  { title: "Caderno Tilibra 10 matérias", source: "Papelaria Central", price: "R$ 34,50", extracted_price: 34.5 },
  { title: "Kit 5 Cadernos Tilibra 10 matérias", source: "Atacadão", price: "R$ 129,90", extracted_price: 129.9 },
  { title: "Caderno Tilibra usado", source: "OLX", price: "R$ 8,00", extracted_price: 8, second_hand_condition: "usado" },
  { title: "Capa para caderno", source: "Shopee", price: "R$ 3,00", extracted_price: 3 },
]

describe("offersFromSerp", () => {
  it("tira usados, kits e preços fora da curva", () => {
    const o = offersFromSerp(caderno, "7891000123454")
    expect(o.map((x) => x.store)).toEqual(["Kalunga", "Amazon.com.br", "Magalu", "Papelaria Central"])
    expect(o[0]).toMatchObject({ price: 32.9, physical: true, url: "https://google.com/p/1" })
    expect(o[1].physical).toBe(false)
  })

  it("mantém kit quando a própria busca é por kit", () => {
    const o = offersFromSerp([{ title: "Kit 5 Cadernos", source: "X", extracted_price: 120 }], "kit 5 cadernos")
    expect(o).toHaveLength(1)
  })

  it("unidade avulsa (1 un) não é kit", () => {
    const o = offersFromSerp([{ title: "Caneta BIC Cristal Azul 1 un", source: "X", extracted_price: 2 }], "caneta bic")
    expect(o).toHaveLength(1)
  })

  it("lê o preço em texto quando falta extracted_price", () => {
    const o = offersFromSerp([{ title: "Estojo", source: "Loja", price: "R$ 1.234,56" }], "estojo")
    expect(o[0].price).toBe(1234.56)
  })
})

describe("adviceFromOffers", () => {
  const offers = offersFromSerp(caderno, "7891000123454")

  it("mediana das lojas + toque da loja, final ,90", () => {
    const a = adviceFromOffers(offers, { markupPct: 10 }, { byBarcode: true })
    expect(a.provider).toBe("shopping")
    expect(a.market).toEqual({ min: 27.99, median: 31.4, max: 34.5 })
    expect(a.suggested).toBe(34.9) // 31,40 × 1,10 = 34,54 → 34,90
    expect(a.range).toEqual({ min: 31.9, max: 37.9 }) // até mediana × 1,20
    expect(a.confidence).toBe("alta")
    expect(a.productName).toBe("Caderno Universitário Tilibra 10 Matérias 160 Folhas")
    expect(a.sources[0]).toEqual({ loja: "Kalunga", preco: 32.9, tipo: "fisica", url: "https://google.com/p/1" })
    expect(a.direction).toMatch(/4 ofertas \(Kalunga, Amazon\.com\.br, Magalu…\)/)
  })

  it("busca por nome não troca o nome do produto", () => {
    expect(adviceFromOffers(offers, { markupPct: 10 }, { byBarcode: false }).productName).toBeNull()
  })

  it("respeita custo + 30%", () => {
    const a = adviceFromOffers(offers, { markupPct: 0, costPrice: 30 }, { byBarcode: true })
    expect(a.suggested).toBe(39.9) // 30 × 1,3 = 39 → 39,90
    expect(a.direction).toMatch(/margem mínima/)
  })

  it("aviso de mercado acima do preço atual", () => {
    expect(adviceFromOffers(offers, { markupPct: 10, currentPrice: 25 }, { byBarcode: true }).marketAbovePct).toBe(26)
  })

  it("nada encontrado: pede o nome; com custo, sugere custo × 2", () => {
    const a = adviceFromOffers([], { markupPct: 10, costPrice: 8 }, { byBarcode: true })
    expect(a.found).toBe(false)
    expect(a.suggested).toBe(16.9)
    expect(a.direction).toMatch(/Digite o nome/)
  })
})

describe("prettyName", () => {
  it("tira o CAIXA ALTA", () => {
    expect(prettyName("CADERNO UNIVERSITARIO TILIBRA 10 MATERIAS")).toBe("Caderno Universitario Tilibra 10 Materias")
    expect(prettyName("CANETA DE GEL COM 12 CORES")).toBe("Caneta de Gel com 12 Cores")
  })
  it("mantém caixa mista", () => {
    expect(prettyName("Caneta BIC Cristal")).toBe("Caneta BIC Cristal")
  })
})
