// Cliente da IA da NVIDIA (NIM, API no formato da OpenAI) — o mesmo modelo
// e os mesmos parâmetros do chat do site. Usado no ajudante e na leitura da
// foto da lista escolar. A chave vem de Settings.nvidiaApiKey (servidor).
// Testado em nvidia.test.ts.

export const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b"

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
export type NvMessage = { role: "system" | "user" | "assistant"; content: string | Part[] }

type Opts = { apiKey: string; model: string; messages: NvMessage[]; signal?: AbortSignal; fetchImpl?: typeof fetch; maxTokens?: number }

/** Corpo da chamada (valores recomendados no model card do Nemotron Super, iguais aos do site). */
export function nvidiaRequest(opts: { model: string; messages: NvMessage[]; stream: boolean; maxTokens?: number }): object {
  return {
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
  const res = await (opts.fetchImpl ?? fetch)(NVIDIA_URL, {
    method: "POST",
    // o endpoint gratuito às vezes leva 1–2 min
    signal: opts.signal ?? AbortSignal.timeout(150_000),
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(nvidiaRequest({ model: opts.model, messages: opts.messages, stream, maxTokens: opts.maxTokens })),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string; error?: { message?: string } | string; message?: string }
    const detail = data.detail ?? (typeof data.error === "string" ? data.error : data.error?.message) ?? data.message ?? ""
    throw new Error(`IA da NVIDIA respondeu ${res.status}${detail ? `: ${detail}` : ""}`)
  }
  return res
}

/** Resposta inteira de uma vez. */
export async function nvidiaChat(opts: Opts): Promise<string> {
  const res = await call(opts, false)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
  return (data.choices?.[0]?.message?.content ?? "").trim()
}

/** Resposta aos pedaços (SSE): só o texto final, sem o raciocínio. */
export async function* nvidiaStream(opts: Opts): AsyncGenerator<string> {
  const res = await call(opts, true)
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
