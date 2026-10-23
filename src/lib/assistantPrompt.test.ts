import { describe, it, expect } from "vitest"
import { assistantSystemPrompt, parseAssistantMessages, type AssistantContext } from "./assistantPrompt"

const period = (faturamento: number) => ({ vendas: 10, faturamento, ticketMedio: faturamento / 10, dinheiro: 1, cartao: 2, pix: 3 })

const ctx = (n = 3): AssistantContext => ({
  loja: "Laçolaria",
  agora: "22/10/2026 10:00",
  hoje: period(123.45),
  ultimos7: period(1000),
  anteriores7: period(800),
  ultimos30: period(5000),
  anteriores30: period(4000),
  maisVendidos30: Array.from({ length: n }, (_, i) => ({ nome: `Produto ${i}`, quantidade: 10 - i, total: 50 })),
  estoqueBaixo: Array.from({ length: n }, (_, i) => ({ nome: `Baixo ${i}`, estoque: 1, minimo: 5 })),
  semEstoque: Array.from({ length: n }, (_, i) => `Zerado ${i}`),
  parados: Array.from({ length: n }, (_, i) => ({ nome: `Parado ${i}`, estoque: 7 })),
})

describe("assistantSystemPrompt", () => {
  it("traz regras e números", () => {
    const p = assistantSystemPrompt(ctx())
    expect(p).toContain("Laçolaria")
    expect(p).toContain("123.45")
    expect(p).toContain("Baixo 0")
    expect(p).toMatch(/só os dados/i)
    expect(p).toMatch(/não (altera|executa)/i)
    expect(p).toMatch(/estoque/i)
  })

  it("cabe em 12 mil caracteres com 15 itens por lista", () => {
    expect(assistantSystemPrompt(ctx(15)).length).toBeLessThan(12_000)
  })
})

describe("parseAssistantMessages", () => {
  it("aceita conversa alternada começando e terminando no usuário", () => {
    expect(parseAssistantMessages({ messages: [{ role: "user", content: " oi " }] })).toEqual([{ role: "user", content: "oi" }])
    expect(
      parseAssistantMessages({
        messages: [
          { role: "user", content: "a" },
          { role: "assistant", content: "b" },
          { role: "user", content: "c" },
        ],
      }),
    ).toHaveLength(3)
  })

  it("recusa formato errado, vazio ou grande demais", () => {
    expect(parseAssistantMessages(null)).toBeNull()
    expect(parseAssistantMessages({ messages: [] })).toBeNull()
    expect(parseAssistantMessages({ messages: [{ role: "assistant", content: "x" }] })).toBeNull()
    expect(parseAssistantMessages({ messages: [{ role: "user", content: "x".repeat(2001) }] })).toBeNull()
    expect(parseAssistantMessages({ messages: [{ role: "system", content: "x" }] })).toBeNull()
  })

  it("guarda só as últimas 20 mensagens, começando no usuário", () => {
    const msgs = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` }))
    const out = parseAssistantMessages({ messages: msgs })!
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out[0].role).toBe("user")
    expect(out.at(-1)!.content).toBe("m24")
  })
})
