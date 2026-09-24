import { describe, it, expect } from "vitest"
import { simplifyMessage, errorText } from "./friendlyError"

describe("simplifyMessage", () => {
  const cases: Array<[string, string]> = [
    ["Insufficient stock for product Caneta. Available: 2, requested: 5", "Estoque insuficiente"],
    ["TypeError: fetch failed", "Sem conexão"],
    ["P1001: Can't reach database server at aws-0-sa-east-1.pooler.supabase.com", "Sem conexão"],
    ["Unique constraint failed on the fields: (`barcode`)", "Código de barras já cadastrado"],
    ["P2002 Unique constraint failed on the fields: (`sku`)", "Código (SKU) já cadastrado"],
    ["Cannot delete category because 3 product(s) are associated with this category", "Em uso — não pode excluir"],
    ["Cannot create sale for non-open cash session", "Caixa fechado"],
    ["Product not found", "Produto não encontrado"],
    ["Sale is already refunded", "Venda já estornada"],
    ["Missing required fields: name, sku, and categoryId are required", "Falta preencher um campo"],
    ["Sale price cannot be negative", "Valor inválido"],
    ["DATABASE_URL não definida. Configure a connection string", "Banco não configurado"],
    ['column "storeProfile" does not exist', "Banco desatualizado — reinicie o app"],
    ["authentication_error: invalid x-api-key", "Chave da IA inválida"],
    ["Unauthorized", "Acesso bloqueado — digite o PIN"],
    // frases curtas em português passam direto
    ["PIN incorreto", "PIN incorreto"],
    ["Informe o nome do produto", "Informe o nome do produto"],
    ["Nome é obrigatório para item avulso", "Nome é obrigatório para item avulso"],
    ["Só há 2 em estoque de Caneta", "Só há 2 em estoque de Caneta"],
    // técnico e desconhecido vira genérico
    ["Unexpected token < in JSON at position 0", "Algo deu errado"],
    ["", "Algo deu errado"],
  ]
  for (const [raw, expected] of cases) {
    it(`"${raw.slice(0, 40)}" -> ${expected}`, () => {
      expect(simplifyMessage(raw)).toBe(expected)
    })
  }

  it("não confunde palavras comuns com o aviso de PIN", () => {
    expect(simplifyMessage("Shopping")).toBe("Shopping")
  })
})

describe("errorText", () => {
  it("lê os dois formatos de resposta da API", () => {
    expect(errorText({ error: "Insufficient stock" })).toBe("Estoque insuficiente")
    expect(errorText({ success: false, error: { message: "Product not found", code: "NOT_FOUND" } })).toBe(
      "Produto não encontrado",
    )
  })
  it("usa o texto padrão quando não há erro", () => {
    expect(errorText({}, "Não foi possível salvar")).toBe("Não foi possível salvar")
    expect(errorText(null, "X")).toBe("X")
  })
  it("aceita exceções", () => {
    expect(errorText(new Error("Failed to fetch"))).toBe("Sem conexão")
  })
})
