import { describe, it, expect } from "vitest"
import { applyStockShortage, stockShortages } from "./cartStock"

const cart = [
  { id: "a", nome: "Caneta", quantidade: 2, estoque: 5, avulso: false },
  { id: "b", nome: "Lápis", quantidade: 3, estoque: 3, avulso: false },
  { id: "avulso-1", nome: "Laço", quantidade: 9, estoque: 0, avulso: true },
]

describe("estoque do carrinho", () => {
  it("item avulso nunca falta; o resto falta quando pede mais do que tem", () => {
    expect(stockShortages(cart)).toEqual([])
    expect(stockShortages([{ ...cart[0], estoque: 1 }])).toEqual([{ id: "a", nome: "Caneta", quantidade: 2, estoque: 1 }])
  })

  it("o servidor avisa que acabou: o item fica com o estoque real e passa a faltar", () => {
    const next = applyStockShortage(cart, { productId: "b", available: 1 })
    expect(next.find((i) => i.id === "b")!.estoque).toBe(1)
    expect(stockShortages(next).map((s) => s.id)).toEqual(["b"])
    expect(applyStockShortage(cart, { productId: "x", available: 0 })).toBe(cart)
  })
})
