// Cliente da IA no formato da OpenAI: NVIDIA (NIM, Nemotron — o mesmo modelo
// e os mesmos parâmetros do chat do site) ou Google Gemini (endpoint
// compatível com a OpenAI: mesmas mensagens, ferramentas e fotos). Quem
// escolhe e cai para a outra quando uma falha é src/lib/llm.ts.
// Testado em nvidia.test.ts.

export const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b"
export const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash"

export type ChatProvider = "nvidia" | "gemini"
const URLS: Record<ChatProvider, string> = { nvidia: NVIDIA_URL, gemini: GEMINI_URL }
export const PROVIDER_LABEL: Record<ChatProvider, string> = { nvidia: "NVIDIA", gemini: "Gemini" }

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
export type NvToolCall = { id: string; type: "function"; function: { name: string; arguments: string } }
export type NvMessage =
  | { role: "system" | "user"; content: string | Part[] }
  | { role: "assistant"; content: string | Part[] | null; tool_calls?: NvToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string }
/** Ferramenta no formato da OpenAI (o NIM aceita igual). */
export type NvTool = { type: "function"; function: { name: string; description: string; parameters: object } }

type Opts = {
  /** padrão "nvidia" */
  provider?: ChatProvider
  apiKey: string
  model: string
  messages: NvMessage[]
  /** cancelamento de quem chamou (ex.: a tela fechou) — o tempo limite vale junto */
  signal?: AbortSignal
  /** padrão 150 s (o endpoint gratuito às vezes leva 1–2 min) */
  timeoutMs?: number
  fetchImpl?: typeof fetch
  maxTokens?: number
  /** ferramentas do agente (só em nvidiaComplete) */
  tools?: NvTool[]
}

/** Erro da IA com o status HTTP (401/403 = chave, 429 = limite). */
export class NvidiaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "NvidiaError"
  }
}

/**
 * Corpo da chamada. NVIDIA: valores recomendados no model card do Nemotron
 * Super, iguais aos do site. Gemini: sem os campos próprios do NIM; raciocínio
 * curto pelo reasoning_effort.
 */
export function nvidiaRequest(opts: { provider?: ChatProvider; model: string; messages: NvMessage[]; stream: boolean; maxTokens?: number; tools?: NvTool[] }): object {
  if (opts.provider === "gemini") {
    return {
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
      model: opts.model,
      stream: opts.stream,
      max_tokens: opts.maxTokens ?? 4096,
      messages: opts.messages,
      reasoning_effort: "low",
    }
  }
  return {
    ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    model: opts.model,
    stream: opts.stream,
    // inclui os tokens de raciocínio, que não aparecem na resposta
    max_tokens: opts.maxTokens ?? 4096,
    temperature: 1.0,
    top_p: 0.95,
    messages: opts.messages,
    // raciocínio curto: sem ele o modelo segue pior as regras
    chat_template_kwargs: { enable_thinking: true, low_effort: true },
  }
}

async function call(opts: Opts, stream: boolean): Promise<Response> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 150_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  try {
    return await request(opts, stream, signal)
  } catch (err) {
    if (timeout.aborted) throw new NvidiaError(`A IA (${PROVIDER_LABEL[opts.provider ?? "nvidia"]}) demorou demais — tente de novo`, 504)
    throw err
  }
}

async function request(opts: Opts, stream: boolean, signal: AbortSignal): Promise<Response> {
  const provider = opts.provider ?? "nvidia"
  const res = await (opts.fetchImpl ?? fetch)(URLS[provider], {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(nvidiaRequest({ provider, model: opts.model, messages: opts.messages, stream, maxTokens: opts.maxTokens, tools: opts.tools })),
  })
  if (!res.ok) {
    // o Gemini responde o erro numa lista ([{ error: {...} }])
    const raw = (await res.json().catch(() => ({}))) as unknown
    const data = (Array.isArray(raw) ? raw[0] : raw) as { detail?: string; error?: { message?: string } | string; message?: string } | undefined
    const detail = data?.detail ?? (typeof data?.error === "string" ? data.error : data?.error?.message) ?? data?.message ?? ""
    throw new NvidiaError(`A IA (${PROVIDER_LABEL[provider]}) respondeu ${res.status}${detail ? `: ${detail}` : ""}`, res.status)
  }
  return res
}

/** Resposta inteira de uma vez. */
export async function nvidiaChat(opts: Opts): Promise<string> {
  const res = await call(opts, false)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
  return (data.choices?.[0]?.message?.content ?? "").trim()
}

/** Uma volta do agente: o texto e/ou as ferramentas que a IA quer usar. */
export async function nvidiaComplete(opts: Opts): Promise<{ content: string; toolCalls: NvToolCall[] }> {
  const res = await call(opts, false)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null; tool_calls?: NvToolCall[] | null } }> }
  const msg = data.choices?.[0]?.message
  return { content: (msg?.content ?? "").trim(), toolCalls: (msg?.tool_calls ?? []).filter((t) => t?.function?.name) }
}

/**
 * Abre a resposta aos pedaços. Espera a NVIDIA responder (status) antes de
 * devolver o gerador — assim chave inválida/limite viram erro antes de a
 * rota começar a transmitir.
 */
export async function nvidiaStreamStart(opts: Opts): Promise<AsyncGenerator<string>> {
  return readSse(await call(opts, true))
}

/** Resposta aos pedaços (SSE): só o texto final, sem o raciocínio. */
export async function* nvidiaStream(opts: Opts): AsyncGenerator<string> {
  yield* await nvidiaStreamStart(opts)
}

async function* readSse(res: Response): AsyncGenerator<string> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === "[DONE]") continue
      try {
        const text = (JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string | null } }> }).choices?.[0]?.delta?.content
        if (text) yield text
      } catch {
        /* linha incompleta ou de controle */
      }
    }
  }
}
