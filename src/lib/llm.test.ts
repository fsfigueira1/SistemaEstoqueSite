import { describe, it, expect } from "vitest"
import { GEMINI_URL, NVIDIA_URL, nvidiaRequest } from "./nvidia"
import { NO_KEY, llmChat, llmComplete, llmTargets } from "./llm"

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }))

function fetchSeq(...responses: Array<Response | Error>) {
  const urls: string[] = []
  const bodies: Record<string, unknown>[] = []
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url))
    bodies.push(JSON.parse(String(init?.body)))
    const r = responses.shift()
    if (r instanceof Error) throw r
    return r as Response
  }) as typeof fetch
  return { f, urls, bodies }
}

const both = { nvidiaApiKey: "<nv>", geminiApiKey: "<gm>", nvidiaModel: "", geminiModel: "" }
const msg = [{ role: "user" as const, content: "oi" }]

describe("qual IA responde (NVIDIA ou Gemini)", () => {
  it("escolhida primeiro, a outra de reserva; só as que têm chave", () => {
    expect(llmTargets({ ...both, aiProvider: "nvidia" }).map((t) => t.provider)).toEqual(["nvidia", "gemini"])
    expect(llmTargets({ ...both, aiProvider: "gemini" }).map((t) => t.provider)).toEqual(["gemini", "nvidia"])
    // Claude só lê foto: o resto fica na NVIDIA
    expect(llmTargets({ ...both, aiProvider: "claude" })[0].provider).toBe("nvidia")
    expect(llmTargets({ aiProvider: "nvidia", geminiApiKey: "<gm>" }).map((t) => t.provider)).toEqual(["gemini"])
    expect(llmTargets({ aiProvider: "gemini", geminiApiKey: "<gm>" })[0].model).toBe("gemini-3.8-flash")
    expect(llmTargets({})).toEqual([])
  })

  it("sem chave nenhuma: erro claro", async () => {
    await expect(llmChat({}, { messages: msg })).rejects.toThrow(NO_KEY)
  })

  it("Gemini: endereço do Google, chave no Bearer, sem os campos próprios da NVIDIA", async () => {
    const { f, urls, bodies } = fetchSeq(ok("oi do gemini"))
    expect(await llmChat({ aiProvider: "gemini", geminiApiKey: "<gm>" }, { messages: msg, fetchImpl: f })).toBe("oi do gemini")
    expect(urls).toEqual([GEMINI_URL])
    expect(bodies[0]).toMatchObject({ model: "gemini-3.8-flash", reasoning_effort: "low" })
    expect(bodies[0]).not.toHaveProperty("chat_template_kwargs")
    expect(nvidiaRequest({ provider: "gemini", model: "g", stream: false, messages: msg, tools: [{ type: "function", function: { name: "x", description: "d", parameters: {} } }] })).toMatchObject({ tool_choice: "auto" })
  })

  it("NVIDIA no limite (429): o Gemini assume na hora", async () => {
    const { f, urls } = fetchSeq(new Response(JSON.stringify({ detail: "rate limit" }), { status: 429 }), ok("respondi eu"))
    expect(await llmChat({ ...both, aiProvider: "nvidia" }, { messages: msg, fetchImpl: f })).toBe("respondi eu")
    expect(urls).toEqual([NVIDIA_URL, GEMINI_URL])
  })

  it("agente com ferramentas também cai para a reserva (erro de rede)", async () => {
    const tool = { id: "1", type: "function", function: { name: "buscar_produtos", arguments: "{}" } }
    const { f, urls } = fetchSeq(new TypeError("fetch failed"), new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [tool] } }] })))
    const r = await llmComplete({ ...both, aiProvider: "gemini" }, { messages: msg, fetchImpl: f })
    expect(urls).toEqual([GEMINI_URL, NVIDIA_URL])
    expect(r.toolCalls[0].function.name).toBe("buscar_produtos")
  })

  it("as duas falham: devolve o erro da escolhida (o erro do Gemini vem em lista)", async () => {
    const { f } = fetchSeq(
      new Response(JSON.stringify([{ error: { message: "API key not valid" } }]), { status: 400 }),
      new Response(JSON.stringify({ detail: "fora do ar" }), { status: 503 }),
    )
    await expect(llmChat({ ...both, aiProvider: "gemini" }, { messages: msg, fetchImpl: f })).rejects.toThrow("A IA (Gemini) respondeu 400: API key not valid")
  })

  it("tela fechada (cancelado): não tenta a outra", async () => {
    const ctrl = new AbortController()
    const f = (async () => {
      ctrl.abort()
      throw new DOMException("aborted", "AbortError")
    }) as unknown as typeof fetch
    let calls = 0
    const counting = (async (...a: Parameters<typeof fetch>) => {
      calls++
      return f(...a)
    }) as typeof fetch
    await expect(llmChat({ ...both }, { messages: msg, fetchImpl: counting, signal: ctrl.signal })).rejects.toThrow()
    expect(calls).toBe(1)
  })
})
