import { describe, it, expect } from "vitest"
import { importKey, parseCsv, parseImport } from "./productImport"
import { meetsTarget, priceForTarget, profitPercent } from "./profit"

describe("planilha de produtos", () => {
  it("lê CSV do Excel brasileiro (;, vírgula decimal, BOM, aspas)", () => {
    const csv = '\uFEFFcodigo_barras;nome;quantidade;custo;preco\n7891027349363;"Lapiseira Bold 2.0mm; sortida";24;2,84;6,50\n'
    expect(parseCsv(csv)).toEqual([
      ["codigo_barras", "nome", "quantidade", "custo", "preco"],
      ["7891027349363", "Lapiseira Bold 2.0mm; sortida", "24", "2,84", "6,50"],
    ])
    const r = parseImport(csv)
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toMatchObject({ barcode: "7891027349363", name: "Lapiseira Bold 2.0mm; sortida", qty: 24, cost: 2.84, price: 6.5 })
  })

  it("entende nomes de coluna diferentes e vírgula como separador", () => {
    const r = parseImport(
      "Código de Barras,Produto,Qtd,Preço de custo,Preço de venda,Fornecedor,Categoria,Preço de mercado,Fontes\n" +
        '7891027392192,Caneta Lid Azul,100,1.00,2.50,Tilibra,Escrita,2.29,"https://a.com/x | https://b.com/y"\n',
    )
    expect(r.rows[0]).toMatchObject({
      barcode: "7891027392192",
      name: "Caneta Lid Azul",
      qty: 100,
      cost: 1,
      price: 2.5,
      supplier: "Tilibra",
      category: "Escrita",
      market: { min: null, median: 2.29, max: null },
      sources: ["https://a.com/x", "https://b.com/y"],
    })
  })

  it("avisa colunas que faltam e linhas ruins", () => {
    expect(parseImport("produto;preco\nx;1").missingColumns).toEqual(["codigo_barras"])
    const r = parseImport("ean;nome;qtd\n;Sem código;1\n7,89103E+12;Excel;2\n789;;3\n7891027392192;Ok;4")
    expect(r.rows.map((x) => x.name)).toEqual(["Ok"])
    expect(r.errors).toHaveLength(3)
    expect(r.errors[1]).toMatch(/Excel estragou/)
  })

  it("mesma planilha = mesma chave (não lança o estoque duas vezes)", () => {
    const a = [{ barcode: "1", sku: null, qty: 2 }]
    expect(importKey(a)).toBe(importKey([{ barcode: "1", sku: null, qty: 2 }]))
    expect(importKey(a)).not.toBe(importKey([{ barcode: "1", sku: null, qty: 3 }]))
  })
})

describe("lucro sobre o custo", () => {
  it("calcula o lucro e o preço para a meta", () => {
    expect(profitPercent(2.84, 6.5)).toBe(128.9)
    expect(profitPercent(0, 6.5)).toBeNull()
    expect(priceForTarget(10, 110)).toBe(21.9)
    expect(priceForTarget(2.62, 110)).toBe(5.9) // 5,50 daria 109,9% → sobe para 5,90
    expect(priceForTarget(2.615, 110)).toBe(5.5)
    expect(meetsTarget(2.615, 5.5, 110)).toBe(true)
    expect(meetsTarget(2.62, 5.5, 110)).toBe(false)
  })
})
