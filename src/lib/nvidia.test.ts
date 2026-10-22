import { describe, it, expect } from "vitest"
import { NVIDIA_URL, nvidiaChat, nvidiaRequest, nvidiaStream } from "./nvidia"

type Call = { url: string; init?: RequestInit }
const fakeFetch = (res: Response) => {
  const calls: Call[] = []
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return res
  }) as typeof fetch
  return { f, calls }
}

describe("nvidia", () => {
  it("nvidiaRequest monta corpo com imagem", () => {
    const body = nvidiaRequest({
      model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } },
            { type: "text", text: "leia" },
          ],
        },
      ],
    }) as Record<string, unknown>
    expect(body).toMatchObject({
      model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
      stream: false,
      max_tokens: 4096,
      temperature: 1.0,
      top_p: 0.95,
      chat_template_kwargs: { enable_thinking: true, low_effort: true },
    })
    expect((body.messages as Array<{ content: unknown[] }>)[0].content[0]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } })
  })

  it("nvidiaChat devolve o texto", async () => {
    const { f, calls } = fakeFetch(new Response(JSON.stringify({ choices: [{ message: { content: "2 lápis" } }] })))
    const text = await nvidiaChat({ apiKey: "k", model: "m", messages: [{ role: "user", content: "oi" }], fetchImpl: f })
    expect(text).toBe("2 lápis")
    expect(calls[0].url).toBe(NVIDIA_URL)
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer k")
  })

  it("nvidiaChat erro vira mensagem clara", async () => {
    const { f } = fakeFetch(new Response(JSON.stringify({ detail: "Invalid API key" }), { status: 401 }))
    await expect(nvidiaChat({ apiKey: "x", model: "m", messages: [{ role: "user", content: "oi" }], fetchImpl: f })).rejects.toThrow(
      "IA da NVIDIA respondeu 401: Invalid API key",
    )
  })

  it("nvidiaStream junta os pedaços e ignora [DONE] e linhas vazias", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Ven"}}]}',
      "",
      'data: {"choices":[{"delta":{"reasoning_content":"pensando"}}]}',
      'data: {"choices":[{"delta":{"content":"das: R$ 10"}}]}',
      "data: [DONE]",
      "",
    ].join("\n")
    // corta no meio de uma linha para testar o buffer
    const enc = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(sse.slice(0, 30)))
        c.enqueue(enc.encode(sse.slice(30)))
        c.close()
      },
    })
    const { f } = fakeFetch(new Response(stream))
    let out = ""
    for await (const t of nvidiaStream({ apiKey: "k", model: "m", messages: [{ role: "user", content: "oi" }], fetchImpl: f })) out += t
    expect(out).toBe("Vendas: R$ 10")
  })
})
