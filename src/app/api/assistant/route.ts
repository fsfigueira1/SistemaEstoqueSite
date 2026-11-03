import { NextResponse } from "next/server"
import { getServerSettings } from "@/lib/serverSettings"
import { isJsonRequest } from "@/lib/requireJson"
import { friendlyError } from "@/lib/friendlyError"
import { assistantSystemPrompt, parseAssistantMessages } from "@/lib/assistantPrompt"
import { NvidiaError } from "@/lib/nvidia"
import { NO_KEY, llmStreamStart, llmTargets } from "@/lib/llm"
import { buildAssistantContext } from "@/services/assistantService"
import { requestRole } from "@/lib/requestRole"

function nvidiaMessage(error: unknown): string {
  const status = error instanceof NvidiaError ? error.status : 0
  // o Gemini responde chave errada com 400 ("API key not valid")
  const badKey = status === 400 && error instanceof Error && /api key/i.test(error.message)
  if (status === 401 || status === 403 || badKey) return "Chave da IA inválida — confira em Configurações"
  if (status === 429) return "Limite de uso da IA atingido — tente de novo em alguns minutos"
  if (status === 504) return "A IA demorou demais — tente de novo"
  return "A IA não respondeu agora — tente de novo"
}

// POST /api/assistant { messages: [{ role, content }] } — ajudante com a IA
// (NVIDIA ou Gemini, uma de reserva da outra). Junta os números da loja (só leitura) e responde em texto, aos
// pedaços (o endpoint gratuito da NVIDIA pode levar mais de 1 minuto).
export async function POST(request: Request) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  const messages = parseAssistantMessages(await request.json().catch(() => null))
  if (!messages) return NextResponse.json({ success: false, error: "Pergunta inválida" }, { status: 400 })

  let settings: Awaited<ReturnType<typeof getServerSettings>>
  let system = ""
  try {
    settings = await getServerSettings()
    if (!llmTargets(settings).length) return NextResponse.json({ success: false, error: NO_KEY }, { status: 400 })
    // balcão: sem os números de vendas (faturamento é só do dono)
    system = assistantSystemPrompt(await buildAssistantContext(), { counter: (await requestRole()) !== "OWNER" })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }

  let chunks: AsyncGenerator<string>
  try {
    chunks = await llmStreamStart(settings, { messages: [{ role: "system", content: system }, ...messages], signal: request.signal })
  } catch (error) {
    friendlyError(error) // registra o detalhe no log do servidor
    return NextResponse.json({ success: false, error: nvidiaMessage(error) }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false
      try {
        for await (const text of chunks) {
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
