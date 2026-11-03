import { describe, it, expect } from "vitest"
import { canAccess, homeFor } from "./access"

describe("quem pode abrir o quê", () => {
  it("dono abre tudo", () => {
    for (const p of ["/dashboard", "/relatorios/mes/2026-11", "/configuracoes", "/api/dashboard/charts", "/api/backup"]) expect(canAccess("OWNER", p)).toBe(true)
    expect(canAccess("OWNER", "/api/products", "DELETE")).toBe(true)
    expect(homeFor("OWNER")).toBe("/dashboard")
  })

  it("balcão: só PDV, Vendas e Atendimento (com as guias)", () => {
    for (const p of ["/pdv", "/vendas", "/atendimento", "/lista-escolar/salvas", "/orcamentos", "/novidades", "/contatos"]) expect(canAccess("EMPLOYEE", p)).toBe(true)
    for (const p of ["/dashboard", "/relatorios", "/relatorios/2026-11-02", "/produtos", "/estoque", "/etiquetas", "/compras", "/revisao", "/configuracoes"])
      expect(canAccess("EMPLOYEE", p)).toBe(false)
    expect(homeFor("EMPLOYEE")).toBe("/pdv")
  })

  it("balcão não chega no faturamento pela API", () => {
    for (const p of ["/api/dashboard/stats", "/api/dashboard/charts", "/api/reports/daily", "/api/reports/monthly", "/api/backup", "/api/auth/credentials", "/api/restock"])
      expect(canAccess("EMPLOYEE", p)).toBe(false)
  })

  it("balcão: PDV consulta produto mas não edita; vende; mexe só no liga/desliga das configurações", () => {
    expect(canAccess("EMPLOYEE", "/api/products", "GET")).toBe(true)
    expect(canAccess("EMPLOYEE", "/api/products/abc", "GET")).toBe(true)
    expect(canAccess("EMPLOYEE", "/api/products", "POST")).toBe(false)
    expect(canAccess("EMPLOYEE", "/api/products/abc", "PUT")).toBe(false)
    expect(canAccess("EMPLOYEE", "/api/stock/movement", "POST")).toBe(false)
    expect(canAccess("EMPLOYEE", "/api/sales/checkout", "POST")).toBe(true)
    expect(canAccess("EMPLOYEE", "/api/cash-session/open", "POST")).toBe(true)
    expect(canAccess("EMPLOYEE", "/api/settings", "GET")).toBe(true)
    expect(canAccess("EMPLOYEE", "/api/settings", "PUT")).toBe(true) // a rota filtra os campos
    expect(canAccess("EMPLOYEE", "/api/settings", "DELETE")).toBe(false)
  })

  it("rota nova fica fechada para o balcão até ser liberada", () => {
    expect(canAccess("EMPLOYEE", "/api/qualquer-coisa-nova")).toBe(false)
    expect(canAccess("EMPLOYEE", "/pagina-nova")).toBe(false)
    // nome parecido não escapa ("/api/sales-report" não é "/api/sales")
    expect(canAccess("EMPLOYEE", "/api/sales-report")).toBe(false)
  })

  it("robô do WhatsApp: só as rotas dele", () => {
    for (const p of ["/api/copilot/auto", "/api/agent/events/x", "/api/agent/winback/next", "/api/agent/handoff"]) expect(canAccess("ROBOT", p, "POST")).toBe(true)
    for (const p of ["/api/copilot", "/api/sales", "/api/dashboard/stats", "/pdv", "/api/settings"]) expect(canAccess("ROBOT", p)).toBe(false)
  })

  it("login e sair são públicos", () => {
    expect(canAccess("EMPLOYEE", "/senha")).toBe(true)
    expect(canAccess("ROBOT", "/api/senha", "POST")).toBe(true)
    expect(canAccess("EMPLOYEE", "/api/logout", "POST")).toBe(true)
  })
})
