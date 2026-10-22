import { NextResponse } from "next/server"
import { getServerSettings } from "@/lib/serverSettings"
import { isJsonRequest } from "@/lib/requireJson"
import { friendlyError } from "@/lib/friendlyError"
import { assistantSystemPrompt, parseAssistantMessages } from "@/lib/assistantPrompt"
import { NVIDIA_DEFAULT_MODEL, nvidiaStream } from "@/lib/nvidia"
import { buildAssistantContext } from "@/services/assistantService"

// POST /api/assistant { messages: [{ role, content }] } — ajudante com IA da
// NVIDIA. Junta os números da loja (só leitura) e responde em texto, aos
// pedaços (o endpoint gratuito da NVIDIA pode levar mais de 1 minuto).
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const messages = parseAssistantMessages(await request.json().catch(() => null))
  if (!messages) return NextResponse.json({ success: false, error: "Pergunta inválida" }, { status: 400 })

  let apiKey = ""
  let model = NVIDIA_DEFAULT_MODEL
  let system = ""
  try {
    const settings = await getServerSettings()
    apiKey = settings.nvidiaApiKey.trim()
    model = settings.nvidiaModel || NVIDIA_DEFAULT_MODEL
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Cadastre a chave da NVIDIA em Configurações para usar o ajudante" }, { status: 400 })
    }
    system = assistantSystemPrompt(await buildAssistantContext())
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false
      try {
        for await (const text of nvidiaStream({ apiKey, model, messages: [{ role: "system", content: system }, ...messages], signal: request.signal })) {
          sent = true
          controller.enqueue(encoder.encode(text))
        }
        if (!sent) controller.enqueue(encoder.encode("Não consegui responder agora, tente de novo."))
      } catch (error) {
        if (!request.signal.aborted) {
          friendlyError(error) // registra o detalhe no log do servidor
          controller.enqueue(encoder.encode(`${sent ? "\n\n" : ""}Não consegui terminar a resposta, tente de novo.`))
        }
      } finally {
        try {
          controller.close()
        } catch {
          /* a tela já fechou a conexão */
        }
      }
    },
  })
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
}
