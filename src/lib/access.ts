// Quem pode abrir o quê. Dono: tudo. Balcão: PDV, Vendas e Atendimento (com
// as guias Lista escolar, Orçamentos, Novidades e Contatos) — nada de
// faturamento, relatórios, painel, cadastro ou configurações. Robô do
// WhatsApp (aplicativo do balcão): só as rotas dele.
// Lista do que É permitido: rota nova fica fechada para o balcão até alguém
// liberar aqui de propósito. Usado no src/proxy.ts. Testado em src/lib/access.test.ts.
import type { Role } from "@/lib/authToken"

export const PUBLIC_PATHS = ["/senha", "/api/senha", "/api/logout"]

const under = (path: string, base: string) => path === base || path.startsWith(base + "/")

/** Telas do balcão (o menu mostra só estas). */
export const EMPLOYEE_PAGES = ["/pdv", "/vendas", "/atendimento", "/lista-escolar", "/orcamentos", "/novidades", "/contatos"]

/** API liberada para o balcão: [caminho, métodos] ("*" = todos). */
const EMPLOYEE_API: Array<[string, "*" | string[]]> = [
  ["/api/me", ["GET"]],
  ["/api/session", ["GET"]],
  // PDV: consulta de produtos (sem editar), venda, caixa, clientes
  ["/api/products", ["GET"]],
  ["/api/categories", ["GET"]],
  ["/api/sales", "*"],
  ["/api/cash-session", "*"],
  ["/api/cash-sessions", "*"],
  ["/api/cash-movements", "*"],
  ["/api/cash-registers", ["GET"]],
  ["/api/customers", "*"],
  // comprovante e PDV leem as configurações; gravar só as do atendimento (filtrado na rota)
  ["/api/settings", ["GET", "PUT"]],
  // Atendimento e guias
  ["/api/copilot", "*"],
  ["/api/agent/alerts", "*"],
  ["/api/agent/today", ["GET"]],
  ["/api/agent/winback", ["GET"]],
  ["/api/quote-requests", "*"],
  ["/api/school-list", "*"],
  ["/api/school-lists", "*"],
  ["/api/contacts", "*"],
  ["/api/broadcasts", "*"],
  // ajudante (sem os números de vendas para o balcão — ver api/assistant)
  ["/api/assistant", ["POST"]],
]

/** Rotas do robô do WhatsApp (aplicativo do balcão). */
const ROBOT_API = ["/api/copilot/auto", "/api/agent/events", "/api/agent/winback/next", "/api/agent/handoff"]

export const homeFor = (role: Role) => (role === "OWNER" ? "/dashboard" : "/pdv")

export function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p)
}

export function canAccess(role: Role, path: string, method = "GET"): boolean {
  if (isPublic(path)) return true
  if (role === "OWNER") return true
  const m = method.toUpperCase()
  if (role === "ROBOT") return ROBOT_API.some((p) => under(path, p))
  // balcão
  if (path.startsWith("/api/")) return EMPLOYEE_API.some(([p, methods]) => under(path, p) && (methods === "*" || methods.includes(m)))
  return EMPLOYEE_PAGES.some((p) => under(path, p))
}

/** Configurações que o balcão pode mudar (liga/desliga do atendimento automático). */
export const EMPLOYEE_SETTINGS = ["waAutoEnabled", "waWinbackEnabled"]
