import { describe, it, expect } from "vitest"
import { findDuplicates } from "./duplicates"

describe("produtos duplicados", () => {
  it("acha por nome, palavras e código", () => {
    const g = findDuplicates([
      { id: "a", name: "Caneta BIC Cristal Azul", barcode: "7891000123457", sku: "7891000123457" },
      { id: "b", name: "caneta bic cristal  azul", barcode: null, sku: "CAN-01" },
      { id: "c", name: "Lapiseira Bold 2.0mm Tilibra – Cores Sortidas", barcode: "7891027349363", sku: "7891027349363" },
      { id: "d", name: "Lapiseira Tilibra Bold 2.0mm Cores Sortidas", barcode: null, sku: "LAP-9" },
      { id: "e", name: "Borracha", barcode: null, sku: "7891027392192" },
      { id: "f", name: "Caneta Lid Azul", barcode: "7891027392192", sku: "X1" },
      { id: "g", name: "Grampeador", barcode: null, sku: "GR-1" },
    ])
    expect(g.map((x) => x.ids.sort())).toEqual([["a", "b"], ["c", "d"], ["e", "f"]])
    expect(g[0].reason).toContain("mesmo nome")
    expect(g[2].reason).toContain("mesmo código")
  })
})
