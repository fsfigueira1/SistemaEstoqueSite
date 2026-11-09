// Agente de IA do WhatsApp (NVIDIA NIM, Nemotron). Lê a conversa, decide o
// que fazer e usa as ferramentas do sistema:
//   buscar_produtos  — "tem X?": procura no estoque
//   montar_orcamento — lista de material ou código de lista salva → orçamento
//                      montado pelo sistema e salvo em Orçamentos pedidos
//   ver_lista_escolar — "qual a lista do 3º ano?": lista salva da escola, com
//                      o texto anexado pelo sistema, do jeito que foi salvo
//   chamar_atendente — passa a conversa para uma pessoa da loja
// Regra de ouro (igual ao copiloto): a IA escreve a conversa; nome de produto
// com preço, total e orçamento são anexados pelo SISTEMA, do cadastro. Texto
// da IA com preço é descartado. Se a NVIDIA não aceitar ferramentas ou cair,
// o atendimento volta para o copiloto simples (CopilotService.draft).
// Testado em tests/agentService.test.ts.
import { classify } from "@/lib/quoteIntent"
import { type NvMessage, type NvTool, type NvToolCall } from "@/lib/nvidia"
import { llmComplete } from "@/lib/llm"
import { getServerSettings, type ServerSettings } from "@/lib/serverSettings"
import { PRICE_RE, buildPersonaPrompt } from "@/lib/copilotStyle"
import { CopilotExampleService } from "@/services/copilotExampleService"
import { CopilotParts, CopilotService, type Built, type DraftResult } from "@/services/copilotService"
import { SavedListService } from "@/services/savedListService"
import { CirandaPaymentService, cirandaReply } from "@/services/cirandaPaymentService"

export type ChatLine = { from: "cliente" | "loja"; text: string }
export type Complete = (messages: NvMessage[], tools: NvTool[]) => Promise<{ content: string; toolCalls: NvToolCall[] }>

export type AgentResult = {
  /** send = pode enviar; human = passa para o atendente */
  action: "send" | "human"
  reply: string
  reason: string
  intent: DraftResult["intent"]
  quoteRequestId: string | null
  total: number | null
  /** o que o agente fez, para a tela ("buscando 'caderno' no estoque") */
  steps: string[]
  /** agente = Nemotron com ferramentas; simples = copiloto de antes (reserva) */
  mode: "agente" | "simples"
  /** só no modo simples: a IA não respondeu e saiu o texto reserva */
  fallback?: boolean
  productFound?: boolean
  productQuery?: string
}

const MAX_ROUNDS = 4
const MAX_HISTORY = 14

export const AGENT_TOOLS: NvTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_produtos",
      description: "Procura um produto no estoque da loja. Use quando o cliente perguntar se tem um produto, quanto custa ou pedir opções.",
      parameters: {
        type: "object",
        properties: { consulta: { type: "string", description: "o produto como o cliente falou, ex.: 'caneta stabilo azul'" } },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "montar_orcamento",
      description:
        "Monta o orçamento com preço e estoque de agora e salva em Orçamentos pedidos. Use para lista de material ou pedido com vários itens e quantidades, ou quando o cliente mandar o código de uma lista salva.",
      parameters: {
        type: "object",
        properties: {
          itens: { type: "string", description: "a lista como o cliente escreveu, um item por linha, com a quantidade (ex.: '2 cadernos 96 folhas')" },
          codigo: { type: "string", description: "código da lista salva, se o cliente mandou um" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_lista_escolar",
      description:
        "Mostra a lista de material de uma série, salva pela loja: livros, material, onde comprar, início das aulas. Use quando o cliente perguntar qual é a lista, o que precisa comprar ou qual livro é pedido para uma série.",
      parameters: {
        type: "object",
        properties: {
          serie: { type: "string", description: "a série como o cliente falou, ex.: '3º ano', 'infantil 4', 'quinto ano'" },
          escola: { type: "string", description: "a escola, só se o cliente falou, ex.: 'São José'" },
        },
        required: ["serie"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_dados_ciranda",
      description:
        "Salva os dados de quem pagou por Pix os livros do Ciranda (APM). Use quando o cliente mandar o nome da criança, o ano escolar ou o nome do responsável para esse pagamento, ou disser que já fez o Pix do Ciranda. Passe só o que o cliente informou.",
      parameters: {
        type: "object",
        properties: {
          crianca: { type: "string", description: "nome da criança" },
          ano: { type: "string", description: "ano escolar, ex.: 'Infantil 4'" },
          responsavel: { type: "string", description: "nome do responsável" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chamar_atendente",
      description:
        "Passa a conversa para uma pessoa da loja. Use para troca, defeito, reclamação, cobrança, desconto ou negociação, encomenda, foto/áudio que você não entende, ou quando não tiver certeza da resposta.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string", description: "o motivo em poucas palavras" } },
        required: ["motivo"],
      },
    },
  },
]

function defaultComplete(s: ServerSettings): Complete {
  return (messages, tools) => llmComplete(s, { messages, tools, timeoutMs: 70_000 })
}

const parseArgs = (t: NvToolCall): Record<string, string> => {
  try {
    const v = JSON.parse(t.function.arguments || "{}") as Record<string, unknown>
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? x : String(x ?? "")]))
  } catch {
    return {}
  }
}

function systemPrompt(s: ServerSettings, persona: string, now: Date): string {
  return `${persona}

Você é a atendente da papelaria ${s.companyName} no WhatsApp e responde sozinha, como uma pessoa da loja, em português do Brasil.

Como trabalhar:
- Leia a conversa e responda a ÚLTIMA mensagem do cliente.
- Cliente pergunta se tem um produto ou o preço → use buscar_produtos.
- Lista de material, pedido com vários itens ou código de lista → use montar_orcamento.
- Cliente pergunta qual é a lista de uma série, o que precisa comprar ou qual livro é pedido → use ver_lista_escolar. Se ele não disse a série, pergunte qual é.
- Cliente pergunta dos livros do Ciranda ou como pagar o material do Infantil → use ver_lista_escolar com a série (Infantil 3, 4 ou 5). O material escolar do Infantil é só com a equipe do colégio.
- Cliente manda nome da criança, ano escolar ou nome do responsável do Pix do Ciranda, ou diz que já pagou → use registrar_dados_ciranda.
- Troca, defeito, reclamação, cobrança, desconto, negociação, encomenda ou dúvida que você não sabe → use chamar_atendente.
- Depois de usar as ferramentas, escreva a mensagem para o cliente.

Regras:
- NUNCA escreva preço, valor, total ou quantidade em estoque: o sistema coloca a lista de produtos ou o orçamento com os preços logo abaixo da sua mensagem.
- Não diga que a loja não tem um produto que você não achou: diga que vai conferir e chame o atendente.
- Use só os dados da loja abaixo; nunca invente prazo, entrega, promoção ou serviço.
- Curto: até 4 linhas, simpático, no máximo 1 emoji.

Dados da loja:
${CopilotParts.storeFacts(s)}
${CopilotParts.nowNote(now)}`
}

function conversation(name: string, text: string, history: ChatLine[] | undefined): string {
  const lines = (history?.length ? history : [{ from: "cliente" as const, text }]).slice(-MAX_HISTORY)
  const who = name ? `Cliente: ${name}` : "Cliente sem nome salvo"
  return `${who}\n\nConversa (a mais recente por último):\n${lines.map((l) => `${l.from === "cliente" ? "Cliente" : "Loja"}: ${l.text.slice(0, 4000)}`).join("\n")}\n\nResponda a última mensagem do cliente.`
}

/** Resultado do copiloto simples no formato do agente. */
const fromDraft = (d: DraftResult, steps: string[]): AgentResult => ({
  action: "send",
  reply: d.reply,
  reason: "",
  intent: d.intent,
  quoteRequestId: d.quoteRequestId,
  total: d.total,
  steps,
  mode: "simples",
  fallback: d.fallback,
  productFound: d.productFound,
  productQuery: d.productQuery,
})

type Found = {
  productBlock: string | null
  quote: { built: Built; block: string } | null
  handoff: string | null
  searched: { query: string; found: boolean } | null
  listBlock: string | null
  /** resposta inteira escrita pelo sistema (pagamento do Ciranda) */
  directReply: string | null
}

async function runTool(call: NvToolCall, s: ServerSettings, f: Found, steps: string[], who: { name: string; phone: string }): Promise<string> {
  const args = parseArgs(call)
  if (call.function.name === "registrar_dados_ciranda") {
    steps.push("salvando dados do Ciranda")
    const saved = await CirandaPaymentService.addDetails(who, { childName: args.crianca, schoolGrade: args.ano, guardianName: args.responsavel })
    f.directReply = cirandaReply(saved)
    return "Dados salvos. O sistema responde ao cliente."
  }
  if (call.function.name === "buscar_produtos") {
    const q = (args.consulta || "").trim().slice(0, 120)
    steps.push(`buscando "${q}" no estoque`)
    const { all, have } = q ? await CopilotParts.findProducts(q) : { all: [], have: [] }
    f.searched = { query: q, found: all.length > 0 }
    if (have.length) {
      f.productBlock = [...CopilotParts.productLines(have), "", "Preço de agora, sujeito à disponibilidade na retirada."].join("\n")
      return `Encontrado e com estoque: ${have.slice(0, 6).map((p) => p.name).join("; ")}. A lista com preços vai anexada pelo sistema.`
    }
    if (all.length) {
      f.productBlock = ["No momento está em falta:", ...CopilotParts.productLines(all)].join("\n")
      return `Existe no cadastro mas está EM FALTA: ${all.slice(0, 6).map((p) => p.name).join("; ")}. Ofereça procurar uma opção parecida.`
    }
    return "Não encontrado no cadastro (pode estar com outro nome). Não diga que não temos: chame o atendente."
  }
  if (call.function.name === "montar_orcamento") {
    steps.push("montando orçamento")
    const built = (args.codigo && (await CopilotParts.savedQuote(args.codigo.trim()))) || (args.itens ? await CopilotParts.listQuote(args.itens) : null)
    if (built && built.lines.some((l) => l.product)) {
      f.quote = { built, block: CopilotParts.quoteText(s.companyName, s.companyAddress, built) }
      const priced = built.lines.filter((l) => l.product).length
      const missing = built.lines.length - priced + built.toConfirm.length
      return `Orçamento pronto com ${priced} itens${missing ? ` (${missing} a loja confere)` : ""}. Ele vai anexado pelo sistema logo abaixo da sua mensagem; escreva só uma abertura curta.`
    }
    return "Não reconheci itens da loja nessa lista. Peça para o cliente mandar a lista de material (texto ou foto) ou chame o atendente."
  }
  if (call.function.name === "ver_lista_escolar") {
    const serie = (args.serie || "").trim().slice(0, 80)
    steps.push(`consultando a lista "${serie}"`)
    const r = await SavedListService.findForCustomer(serie, (args.escola || "").trim().slice(0, 80))
    if (r.status === "no_school") return `Essa escola não tem lista salva. Escolas com lista: ${r.schools.join("; ") || "nenhuma"}. Diga isso ao cliente e ofereça montar o orçamento se ele mandar a lista (texto ou foto).`
    if (r.status === "no_grade") return `Não há lista salva para "${serie}". Séries com lista: ${r.grades.join("; ")}. Se o cliente não disse a série, pergunte; senão, diga as que temos e ofereça montar o orçamento se ele mandar a lista.`
    if (r.status === "many_schools") return `Mais de uma escola tem essa série: ${r.schools.join("; ")}. Pergunte de qual escola é.`
    const { list } = r
    f.listBlock = [list.sourceText, ...(list.quotable ? [`Para receber o orçamento dos materiais com os preços de hoje, é só responder: #${list.code}`] : [])].join("\n\n")
    // Infantil tem script pronto da APM: vai sem nenhuma frase escrita pela IA
    if (/^infantil/i.test(list.grade)) {
      const first = CopilotParts.firstName(who.name)
      f.directReply = `${first ? `Oi, ${first}!` : "Olá!"} Seguem as informações do ${list.grade}:\n\n${f.listBlock}`
    }
    return `Lista encontrada: ${list.schoolName}, ${list.grade}, ano letivo ${list.schoolYear}. O texto completo vai anexado pelo sistema logo abaixo da sua mensagem; escreva só uma abertura curta, sem copiar a lista.${list.quotable ? ` Se o cliente pediu orçamento, use montar_orcamento com o código ${list.code}.` : ""}`
  }
  if (call.function.name === "chamar_atendente") {
    f.handoff = (args.motivo || "o agente pediu ajuda").slice(0, 160)
    steps.push("chamando o atendente")
    return "Atendente avisado."
  }
  return "Ferramenta desconhecida."
}

export const AgentService = {
  async run(
    input: { name: string; phone: string; text: string; history?: ChatLine[] },
    deps: { complete?: Complete; now?: Date; ai?: (system: string, user: string) => Promise<string> } = {},
  ): Promise<AgentResult> {
    const s = await getServerSettings()
    const now = deps.now ?? new Date()
    const name = input.name.trim().slice(0, 120)
    const text = input.text.trim().slice(0, 8000)
    const kind = classify(text).kind
    const simple = async (steps: string[]) => {
      const d = await CopilotService.draft({ name, phone: input.phone, text, replaceId: null }, { ai: deps.ai, now })
      return fromDraft(d, d.quoteRequestId ? [...steps, "salvo em Orçamentos"] : steps)
    }

    // pedido do site e código de lista: o caminho do sistema já é exato
    if (kind === "site") return simple(["lendo o pedido do site", "montando orçamento"])
    if (kind === "code") return simple(["abrindo a lista salva", "montando orçamento"])

    const persona = buildPersonaPrompt(s.copilotPersona, await CopilotExampleService.list(6))
    const complete = deps.complete ?? defaultComplete(s)
    const first = CopilotParts.firstName(name)
    const steps: string[] = ["lendo a conversa"]
    const messages: NvMessage[] = [
      { role: "system", content: systemPrompt(s, persona, now) },
      { role: "user", content: conversation(name, text, input.history) },
    ]
    const f: Found = { productBlock: null, quote: null, handoff: null, searched: null, listBlock: null, directReply: null }
    let content = ""

    try {
      for (let round = 0; round < MAX_ROUNDS && !f.handoff; round++) {
        const r = await complete(messages, AGENT_TOOLS)
        if (!r.toolCalls.length) {
          content = r.content
          break
        }
        messages.push({ role: "assistant", content: r.content || null, tool_calls: r.toolCalls })
        for (const call of r.toolCalls) messages.push({ role: "tool", tool_call_id: call.id, content: await runTool(call, s, f, steps, { name, phone: input.phone }) })
      }
    } catch {
      // NVIDIA sem ferramentas, fora do ar ou sem chave: copiloto simples
      return simple(["lendo a conversa", "respondendo (modo simples)"])
    }

    const intent: DraftResult["intent"] = f.quote ? "list" : f.searched ? "product" : "other"
    const base = { quoteRequestId: null, total: null, steps, mode: "agente" as const, intent, productQuery: f.searched?.query }
    if (f.handoff) return { ...base, action: "human", reply: "", reason: f.handoff }
    if (f.directReply) {
      steps.push("resposta pronta")
      return { ...base, action: "send", reply: f.directReply, reason: "" }
    }
    // lista que o agente não orçou: não arrisca, o atendente vê
    if (kind === "list" && !f.quote && !f.listBlock) return { ...base, action: "human", reply: "", reason: "lista de material que o agente não conseguiu orçar", intent: "list" }
    if (f.searched && !f.searched.found)
      return { ...base, action: "human", reply: "", reason: `não achei "${f.searched.query}" no estoque — confira se tem com outro nome`, productFound: false }

    // texto da IA com preço, vazio ou enorme: não vai sozinho
    let opening = content.trim()
    if (!opening || opening.length > 700 || PRICE_RE.test(opening)) {
      if (!f.quote && !f.productBlock && !f.listBlock) return { ...base, action: "human", reply: "", reason: "a IA não conseguiu escrever uma resposta segura" }
      const hi = first ? `Oi, ${first}!` : "Olá!"
      opening = f.quote ? `${hi} Segue o orçamento:` : f.productBlock ? `${first ? `Oi, ${first}!` : "Oi!"} Temos sim 😊` : `${hi} Segue a lista:`
    }
    const attached = f.quote?.block ?? f.productBlock ?? f.listBlock
    const reply = attached ? `${opening}\n\n${attached}` : opening
    if (f.quote) {
      const saved = await CopilotParts.saveQuote({ name, phone: input.phone }, f.quote.built, reply)
      steps.push("salvo em Orçamentos")
      return { ...base, action: "send", reply, reason: "", quoteRequestId: saved.id, total: saved.total }
    }
    steps.push("resposta pronta")
    return { ...base, action: "send", reply, reason: "", productFound: f.searched ? f.searched.found : undefined }
  },
}
