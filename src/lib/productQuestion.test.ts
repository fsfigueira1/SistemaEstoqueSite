import { describe, it, expect } from "vitest"
import { productQuery } from "./productQuestion"

describe("o que o cliente está procurando", () => {
  it("tira o produto da pergunta", () => {
    expect(productQuery("Tem stabilo pastel azul?")).toBe("stabilo pastel azul")
    expect(productQuery("Vocês têm papel crepom vermelho?")).toBe("papel crepom vermelho")
    expect(productQuery("Oi, boa tarde!\nVcs vendem cola glitter?")).toBe("cola glitter")
    expect(productQuery("Ainda tem caderno da Barbie?")).toBe("caderno da barbie")
    expect(productQuery("tem disponível marca texto amarelo aí na loja?")).toBe("marca texto amarelo")
    expect(productQuery("Boa tarde, vocês trabalham com tinta guache?")).toBe("tinta guache")
    expect(productQuery("Teria lapiseira 0,7 por favor")).toBe("lapiseira 0,7")
    expect(productQuery("Tem aquele caderno do batman?")).toBe("caderno do batman")
    expect(productQuery("vcs tem essa mochila da stitch")).toBe("mochila da stitch")
  })

  it("não é pergunta de produto", () => {
    expect(productQuery("Que horas vocês abrem?")).toBeNull()
    expect(productQuery("Aceita pix?")).toBeNull()
    expect(productQuery("Bom dia!")).toBeNull()
    expect(productQuery("Tem como entregar?")).toBeNull()
    expect(productQuery("Tem estacionamento?")).toBeNull()
  })
})
