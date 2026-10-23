// Ajudante com IA: as regras e os números da loja que vão junto de cada
// pergunta. A IA só vê o que está aqui — por isso as regras insistem em
// "só os dados" e "não executa nada". Testado em assistantPrompt.test.ts.

export type PeriodSummary = { vendas: number; faturamento: number; ticketMedio: number; dinheiro: number; cartao: number; pix: number }

export type AssistantContext = {
  loja: string
  agora: string
  hoje: PeriodSummary
  ultimos7: PeriodSummary
  anteriores7: PeriodSummary
  ultimos30: PeriodSummary
  anteriores30: PeriodSummary
  maisVendidos30: Array<{ nome: string; quantidade: number; total: number }>
  estoqueBaixo: Array<{ nome: string; estoque: number; minimo: number }>
  semEstoque: string[]
  parados: Array<{ nome: string; estoque: number }>
}

export function assistantSystemPrompt(ctx: AssistantContext): string {
  return `Você é o ajudante do sistema da papelaria ${ctx.loja}. Fala com a dona e os funcionários, em português do Brasil, de forma curta e direta.

O que você faz:
- Responde sobre vendas e relatórios (dia, últimos 7 e 30 dias, comparação com o período anterior, formas de pagamento, mais vendidos).
- Responde sobre estoque (o que está acabando, o que zerou, o que está parado sem vender).
- Sugere ideias e textos curtos (ex.: novidade para mandar aos clientes no WhatsApp), usando só produtos que TÊM estoque.

Regras:
- Use só os dados abaixo. Se a pergunta pedir algo que não está nos dados, diga que não tem essa informação aqui.
- Nunca invente números, produtos ou preços. Valores em reais (R$), com vírgula.
- Você não altera nada no sistema e não executa ações (não lança venda, não muda preço, não envia mensagem). Se pedirem, explique onde a pessoa faz isso no sistema.
- Respostas curtas: no máximo uns 8 itens em listas. Texto para cliente: até 4 linhas, tom acolhedor, pode usar 1 ou 2 emojis.

Dados da loja (atualizados agora, ${ctx.agora}; "faturamento" em R$; formas de pagamento em R$):
${JSON.stringify(ctx)}`
}

export type AssistantMessage = { role: "user" | "assistant"; content: string }

const MAX_MESSAGES = 20
const MAX_CHARS = 2000

/** Valida a conversa vinda da tela: alterna usuário/ajudante, começa e termina no usuário. */
export function parseAssistantMessages(body: unknown): AssistantMessage[] | null {
  const raw = (body as { messages?: unknown } | null)?.messages
  if (!Array.isArray(raw) || !raw.length) return null
  const out: AssistantMessage[] = []
  for (const [i, m] of raw.entries()) {
    const role = (m as { role?: unknown })?.role
    const content = (m as { content?: unknown })?.content
    const expected = i % 2 === 0 ? "user" : "assistant"
    if (role !== expected || typeof content !== "string") return null
    const text = content.trim()
    if (!text || text.length > MAX_CHARS) return null
    out.push({ role: expected, content: text })
  }
  if (out.at(-1)?.role !== "user") return null
  const start = Math.max(0, out.length - MAX_MESSAGES)
  return out.slice(start % 2 === 0 ? start : start + 1)
}
