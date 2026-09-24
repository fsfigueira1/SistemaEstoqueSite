// Nomes de erro curtos e em português para quem está no balcão.
//
// O sistema tem mensagens técnicas espalhadas (em inglês, códigos do Prisma,
// falhas de rede). Em vez de reescrever cada serviço, tudo passa por aqui
// antes de chegar na tela: vira um nome curto ("Estoque insuficiente",
// "Sem conexão") e o detalhe técnico fica só no console/log.
//
// Serve para o servidor (rotas de API) e para o navegador (telas).

type Rule = { test: RegExp; title: string | ((m: RegExpMatchArray) => string) }

// Marcador que separa as regras "críticas" (IA, conexão, banco, acesso) das
// gerais. Frases curtas que já estão em português são mantidas depois das
// críticas e antes das gerais: "Nome é obrigatório para item avulso" é mais
// útil que "Falta preencher um campo".
const GENERAL_MARK: Rule = { test: /$^/, title: "" }

// A ordem importa: regras mais específicas primeiro.
const RULES: Rule[] = [
  // --- pesquisa de preço grátis (Cosmos) ---
  { test: /cosmos token missing/i, title: "Pesquisa de preço não configurada" },
  { test: /cosmos http 429/i, title: "Consultas grátis de hoje acabaram — amanhã volta" },
  { test: /cosmos http 40[13]/i, title: "Token do Cosmos inválido" },
  { test: /cosmos http 5\d\d/i, title: "Base de preços fora do ar — tente mais tarde" },

  // --- IA de preços (antes das regras genéricas) ---
  { test: /timeout na pesquisa/i, title: "A pesquisa demorou — tente de novo" },
  { test: /formato inesperado/i, title: "A IA não respondeu direito — tente de novo" },
  { test: /not_found_error.*model|model.*not.?found/i, title: "Modelo da IA indisponível — troque em Configurações" },

  // --- conexão / banco ---
  { test: /DATABASE_URL/i, title: "Banco não configurado" },
  { test: /column .* does not exist|relation .* does not exist|P2021|P2022/i, title: "Banco desatualizado — reinicie o app" },
  {
    test: /fetch failed|failed to fetch|networkerror|network request failed|load failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|can't reach database|P1001|P1002|P1008|P1017|connection terminated|timeout|timed out|aborted|offline|sem internet|erro de rede/i,
    title: "Sem conexão",
  },
  { test: /too many (clients|connections)|remaining connection slots|circuit breaker|P2024/i, title: "Sistema ocupado — tente de novo" },

  // --- IA ---
  { test: /invalid x-api-key|authentication_error|invalid api key|chave da ia inválida/i, title: "Chave da IA inválida" },
  { test: /credit balance|billing|insufficient.*credit|sem crédito/i, title: "Sem crédito na IA" },
  { test: /rate.?limit|overloaded|\bHTTP (429|529)\b/i, title: "IA ocupada — tente em 1 minuto" },
  { test: /chave da ia|ai key missing|aiApiKey/i, title: "IA não configurada" },

  // --- acesso ---
  { test: /[Uu]nauthori[sz]ed|UNAUTHORIZED|\bstatus 401\b|\bHTTP 401\b/, title: "Acesso bloqueado — digite o PIN" },
  { test: /forbidden|\bHTTP 403\b/i, title: "Sem permissão" },

  // --- a partir daqui: regras gerais (frases curtas em português passam antes) ---
  GENERAL_MARK,

  // --- duplicados ---
  {
    test: /(unique|already exists|duplicate|P2002|já existe|já cadastrad).*(barcode|c[óo]digo de barras)|(barcode|c[óo]digo de barras).*(unique|already exists|duplicate|P2002|já existe|já cadastrad)/i,
    title: "Código de barras já cadastrado",
  },
  { test: /(unique|already exists|duplicate|P2002).*sku|sku.*(unique|already exists|duplicate|P2002)/i, title: "Código (SKU) já cadastrado" },
  { test: /phone number already exists/i, title: "Telefone já cadastrado" },
  { test: /email already exists/i, title: "E-mail já cadastrado" },
  { test: /name already exists/i, title: "Nome já cadastrado" },
  { test: /already has an open session/i, title: "Caixa já está aberto" },
  { test: /unique constraint|already exists|duplicate|P2002|já existe|já cadastrad/i, title: "Já cadastrado" },

  // --- em uso ---
  { test: /cannot delete .*(product|sale|associated)|related records|foreign key|P2003|P2014/i, title: "Em uso — não pode excluir" },

  // --- estoque ---
  { test: /insufficient stock|estoque insuficiente|stock availability/i, title: "Estoque insuficiente" },
  { test: /inactive or discontinued|inativo|descontinuado/i, title: "Produto inativo" },

  // --- venda / caixa ---
  { test: /non-open cash session|cash session is already closed|caixa fechado|nenhum caixa/i, title: "Caixa fechado" },
  { test: /already refunded|only completed sales can be refunded|no paid payment to refund|only paid payments can be refunded/i, title: "Venda já estornada" },
  { test: /already cancelled|cancelled sale/i, title: "Venda cancelada" },
  { test: /already completed|completed sale/i, title: "Venda já concluída" },
  { test: /payment.*exceed|exceeds remaining/i, title: "Valor maior que o total" },
  { test: /invalid payment method|forma de pagamento/i, title: "Escolha a forma de pagamento" },
  { test: /installment/i, title: "Parcelamento inválido" },
  { test: /at least one item|pelo menos um item|ao menos um item|must have at least one item/i, title: "Adicione um item" },

  // --- não encontrado ---
  { test: /product not found|produto não encontrado/i, title: "Produto não encontrado" },
  { test: /sale not found|venda não encontrada/i, title: "Venda não encontrada" },
  { test: /customer not found/i, title: "Cliente não encontrado" },
  { test: /supplier not found/i, title: "Fornecedor não encontrado" },
  { test: /category not found/i, title: "Categoria não encontrada" },
  { test: /cash (session|register) not found/i, title: "Caixa não encontrado" },
  { test: /not found|P2025|\bHTTP 404\b|não encontrad/i, title: "Não encontrado" },

  // --- validação ---
  { test: /greater than maximum/i, title: "Mínimo maior que o máximo" },
  { test: /cannot be negative|must be positive|must not be zero|negativ/i, title: "Valor inválido" },
  { test: /invalid email/i, title: "E-mail inválido" },
  { test: /required|missing|obrigat[óo]ri/i, title: "Falta preencher um campo" },
  { test: /invalid|inválid/i, title: "Dado inválido" },
]

const GENERIC = "Algo deu errado"

// Palavras que denunciam mensagem técnica/em inglês — nesses casos nunca
// mostramos a mensagem original.
const TECHNICAL =
  /\b(the|cannot|error|failed|invalid|undefined|null|prisma|exception|stack|internal|server|status|request|response|unexpected|token|JSON|TypeError|SyntaxError)\b|P\d{4}|https?:\/\//i

/** Converte qualquer mensagem de erro em um nome curto em português. */
const PORTUGUESE = /[áéíóúãõâêôçà]|\b(não|para|com|sem|informe|digite|escolha|selecione|produto|venda|caixa|estoque)\b/i

export function simplifyMessage(raw: unknown): string {
  const msg = String(raw ?? "").trim()
  if (!msg) return GENERIC
  for (const rule of RULES) {
    if (rule === GENERAL_MARK) {
      if (msg.length <= 60 && PORTUGUESE.test(msg) && !TECHNICAL.test(msg)) return msg
      continue
    }
    const m = msg.match(rule.test)
    if (m) return typeof rule.title === "function" ? rule.title(m) : rule.title
  }
  // Já é uma frase curta em português? Mantém (ex.: "Informe o nome do produto").
  if (msg.length <= 60 && !TECHNICAL.test(msg)) return msg
  return GENERIC
}

function rawMessage(error: unknown): string {
  if (!error) return ""
  if (typeof error === "string") return error
  if (typeof error === "object") {
    const e = error as { code?: unknown; message?: unknown; error?: unknown }
    const parts = [e.code, e.message].filter(Boolean).map(String)
    if (parts.length) return parts.join(" ")
    if (e.error) return rawMessage(e.error)
  }
  return String(error)
}

/**
 * Para rotas de API: devolve `{ message, code }` com o nome curto.
 * O detalhe técnico vai para o console do servidor.
 */
export function friendlyError(error: unknown): { message: string; code: string } {
  const raw = rawMessage(error)
  // Detalhe técnico só no log do servidor (terminal/arquivo do app), nunca na tela.
  if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line quality/no-direct-console -- o helper pino (src/lib/logger.ts) depende de pino-pretty, que não está instalado
    console.error("[erro]", raw || error)
  }
  const message = simplifyMessage(raw)
  const code =
    typeof error === "object" && error && "code" in error && typeof (error as { code: unknown }).code === "string"
      ? String((error as { code: string }).code)
      : "ERRO"
  return { message, code }
}

/**
 * Para as telas: lê o erro de uma resposta da API (qualquer formato que o
 * sistema usa) ou de uma exceção, e devolve o nome curto.
 */
export function errorText(source: unknown, fallback = GENERIC): string {
  if (!source) return fallback
  if (source instanceof Error) return simplifyMessage(source.message)
  if (typeof source === "string") return simplifyMessage(source)
  if (typeof source === "object") {
    const s = source as { error?: unknown; message?: unknown }
    const err = s.error ?? s.message
    if (typeof err === "string") return simplifyMessage(err)
    if (err && typeof err === "object" && "message" in err) {
      return simplifyMessage((err as { message: unknown }).message)
    }
  }
  return fallback
}
