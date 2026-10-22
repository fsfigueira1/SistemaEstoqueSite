import { describe, it, expect } from "vitest"
import { DEFAULT_PERSONA, PRICE_RE, buildPersonaPrompt, styleSample } from "./copilotStyle"

const QUOTE_REPLY = `Oi, Ana! Que alegria te ver por aqui 🎀 Separei tudo com carinho:

Orçamento Laçolaria — sua lista

• 2 × Caderno — R$ 25,80

Total: R$ 25,80

Retirada na loja: Av. X.`

describe("styleSample", () => {
  it("exemplo tira orçamento e preço", () => {
    expect(styleSample(QUOTE_REPLY)).toBe("Oi, Ana! Que alegria te ver por aqui 🎀 Separei tudo com carinho:")
    expect(styleSample("Fica por R$ 10, viu?\nQualquer coisa me chama! 😊")).toBe("Qualquer coisa me chama! 😊")
    expect(styleSample("Orçamento Laçolaria — x\n• 1 × y — R$ 1,00")).toBeNull()
    expect(styleSample("   ")).toBeNull()
    expect(styleSample("a".repeat(900))!.length).toBeLessThanOrEqual(400)
  })
})

describe("buildPersonaPrompt", () => {
  it("prompt traz persona e no máximo 6 exemplos", () => {
    const ex = Array.from({ length: 9 }, (_, i) => ({ customerText: `pergunta ${i}`, finalReply: `resposta carinhosa ${i} 😊` }))
    const p = buildPersonaPrompt("", ex)
    expect(p).toContain(DEFAULT_PERSONA)
    expect((p.match(/Cliente:/g) ?? []).length).toBe(6)
    expect(p).toContain("resposta carinhosa 0")
    expect(p).not.toContain("resposta carinhosa 6")
    expect(buildPersonaPrompt("Seja formal.", [])).toContain("Seja formal.")
    expect(buildPersonaPrompt("Seja formal.", [])).not.toContain("Cliente:")
  })

  it("persona padrão é carismática e proíbe inventar preço", () => {
    expect(DEFAULT_PERSONA).toMatch(/carism/i)
    expect(DEFAULT_PERSONA).toMatch(/nunca invente pre/i)
    expect(PRICE_RE.test("custa 20 reais")).toBe(true)
  })
})
