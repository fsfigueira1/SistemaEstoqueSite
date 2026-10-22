import { describe, it, expect } from "vitest"
import { classify, extractListCode, looksLikeList, parseOrcamentoSite } from "./quoteIntent"

const PEDIDO_SITE = `Olá! Vim pelo site e quero um orçamento para retirar na loja:

*3º ano · Fundamental*
Material escolar:
- 4x Caderno brochura 96 folhas (capa dura) [SKU 7891027116804]
- 6x Lápis grafite nº 2 [SKU 7908673911759]
- 1x Caixa de lápis de cor 24 cores [SKU 314955]
- 1x Tinta guache 6 cores
Uniforme:
- 1x Camiseta manga cobalto, tamanho 2 [SKU 2000000000022]

*1ª série · Médio*
Uniforme:
- 2x Camiseta manga vinho, tamanho M [SKU 1000002285404]

Obrigado!
#ORC-SITE v1`

describe("parseOrcamentoSite (cópia do robô do site)", () => {
  it("lê os grupos e os itens", () => {
    const p = parseOrcamentoSite(PEDIDO_SITE)!
    expect(p.grupos.map((g) => [g.titulo, g.itens.length])).toEqual([
      ["3º ano · Fundamental", 5],
      ["1ª série · Médio", 1],
    ])
    const itens = p.grupos.flatMap((g) => g.itens)
    expect(itens.find((i) => i.descricao.startsWith("Tinta"))).toEqual({ qtd: 1, descricao: "Tinta guache 6 cores", sku: null, secao: "material" })
    expect(itens.find((i) => i.descricao.startsWith("Camiseta manga cobalto"))).toMatchObject({ sku: "2000000000022", secao: "uniforme" })
  })

  it("sem a marca não é do site; texto depois da marca é ignorado; aceita \\r\\n", () => {
    expect(parseOrcamentoSite(PEDIDO_SITE.replace("#ORC-SITE v1", ""))).toBeNull()
    expect(parseOrcamentoSite(PEDIDO_SITE.replace("#ORC-SITE v1", "#ORC-SITE v2"))).toBeNull()
    expect(parseOrcamentoSite(PEDIDO_SITE + "\nPode separar pra sexta?")!.grupos.flatMap((g) => g.itens)).toHaveLength(6)
    expect(parseOrcamentoSite(PEDIDO_SITE.replace(/\n/g, "\r\n"))!.grupos.flatMap((g) => g.itens)).toHaveLength(6)
  })
})

describe("extractListCode e looksLikeList", () => {
  it("acha o código e reconhece lista", () => {
    expect(extractListCode("Quero a lista #l-3a7k por favor")).toBe("L-3A7K")
    expect(extractListCode("sem código")).toBeNull()
    expect(looksLikeList("2 lápis\n1 borracha")).toBe(true)
    expect(looksLikeList("que horas vocês abrem?")).toBe(false)
  })
})

describe("classify", () => {
  it("ordem: site → código → lista → outra", () => {
    expect(classify(PEDIDO_SITE + "\nPode separar pra sexta?").kind).toBe("site")
    expect(classify("Oi, quero o orçamento #L-3A7K")).toEqual({ kind: "code", code: "L-3A7K" })
    expect(classify("2 lápis\n1 borracha").kind).toBe("list")
    expect(classify("2 lápis\n1 camiseta tam l-azul").kind).toBe("list")
    expect(classify("que horas vocês abrem?").kind).toBe("other")
  })
})
