import { describe, it, expect } from "vitest"
import { allocate, buildQuote, matchScore, parseList, quoteMessage, quoteTotals, stem, tokens, type CatalogProduct } from "./schoolList"

const P = (id: string, name: string, salePrice: number, stock: number, category = ""): CatalogProduct => ({
  id, name, salePrice, stock, category, barcode: null, sku: null,
})

const catalog = [
  P("cad10", "Caderno Universitário 10 Matérias 200 folhas Capa Dura", 32.9, 12, "Cadernos"),
  P("cadbr", "Caderno Brochura 96 folhas Capa Dura", 12.9, 30, "Cadernos"),
  P("lap", "Lápis Preto HB nº 2 Faber-Castell", 1.5, 200, "Escrita"),
  P("lc12", "Lápis de Cor 12 cores Faber-Castell", 18.9, 8, "Escrita"),
  P("lc24", "Lápis de Cor 24 cores Faber-Castell", 34.9, 0, "Escrita"),
  P("bor", "Borracha Branca Mercur", 2.5, 50, "Escrita"),
  P("apo", "Apontador com Depósito", 4.9, 20, "Escrita"),
  P("col", "Cola Branca Tenaz 90g", 5.9, 3, "Colagem"),
  P("tes", "Tesoura Escolar sem Ponta Tramontina", 9.9, 15, "Corte"),
  P("gz", "Giz de Cera Grosso 12 cores", 11.9, 10, "Artes"),
]

describe("lista escolar — leitura", () => {
  it("acha quantidade no começo, no fim e por extenso", () => {
    const l = parseList(`LISTA DE MATERIAL ESCOLAR 2027 - 3º ANO
Escola Municipal Monteiro Lobato
1. 02 cadernos universitários 10 matérias
- 3 lápis preto nº 2
• 2x borracha branca
Uma tesoura sem ponta
Cola branca 90g - 2 unidades
1 cx de lápis de cor 12 cores
apontador com depósito
(Obs: todo material deve vir com nome)`)
    expect(l.map((x) => [x.qty, x.text])).toEqual([
      [2, "cadernos universitários 10 matérias"],
      [3, "lápis preto nº 2"],
      [2, "borracha branca"],
      [1, "tesoura sem ponta"],
      [2, "Cola branca 90g"],
      [1, "cx de lápis de cor 12 cores"],
      [1, "apontador com depósito"],
    ])
  })

  it("plural vira singular do mesmo jeito dos dois lados", () => {
    expect(stem("cadernos")).toBe("caderno")
    expect(stem("cores")).toBe("cor")
    expect(stem("lapis")).toBe("lapis")
    expect(stem("pinceis")).toBe("pincel")
    expect(stem("apontadores")).toBe("apontador")
    expect(tokens("200fls")).toEqual(["200", "folha"])
  })
})

describe("lista escolar — orçamento", () => {
  it("casa cada item com o produto certo", () => {
    const q = buildQuote(
      `2 cadernos universitários 10 matérias
3 lápis preto
2 borrachas
1 caixa de lápis de cor 12 cores
1 cola branca
1 tesoura sem ponta
1 caixa de giz de cera
1 compasso`,
      catalog,
    )
    expect(q.map((l) => l.productId)).toEqual(["cad10", "lap", "bor", "lc12", "col", "tes", "gz", null])
  })

  it("12 cores não casa com 24 cores", () => {
    expect(matchScore("lápis de cor 12 cores", catalog[3])).toBeGreaterThan(matchScore("lápis de cor 12 cores", catalog[4]))
    expect(matchScore("lápis de cor 24 cores", catalog[4])).toBeGreaterThan(matchScore("lápis de cor 24 cores", catalog[3]))
  })

  it("soma só o que tem em estoque e avisa o que falta", () => {
    const byId = new Map(catalog.map((p) => [p.id, p]))
    const lines = [
      { qty: 2, product: byId.get("cad10") ?? null, text: "cadernos" },
      { qty: 5, product: byId.get("col") ?? null, text: "cola" }, // só tem 3
      { qty: 1, product: null, text: "compasso" },
      { qty: 1, product: byId.get("lc24") ?? null, text: "lápis de cor 24" }, // sem estoque
    ]
    expect(quoteTotals(lines)).toEqual({ total: 83.5, items: 5, missing: 1, short: 2 })
    const msg = quoteMessage("Laçolaria", "Ana — 3º ano", lines, (v) => `R$ ${v.toFixed(2)}`)
    expect(msg).toContain("Orçamento Laçolaria — Ana — 3º ano")
    expect(msg).toContain("• 3 × Cola Branca Tenaz 90g — R$ 17.70")
    expect(msg).toContain("Total: R$ 83.50")
    expect(msg).toContain("• 2 × cola (faltou)")
    expect(msg).toContain("• 1 × compasso")
  })

  it("duas linhas no mesmo produto dividem o estoque", () => {
    const cola = catalog.find((p) => p.id === "col") ?? null // estoque 3
    const lines = [
      { qty: 2, product: cola, text: "cola branca" },
      { qty: 2, product: cola, text: "cola" },
    ]
    expect(allocate(lines)).toEqual([2, 1])
    expect(quoteTotals(lines)).toMatchObject({ items: 3, short: 1 })
  })
})
