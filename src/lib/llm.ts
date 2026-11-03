// Qual IA responde (ajudante, agente do WhatsApp, avisos, chamar de volta,
// foto da lista): a escolhida em Configurações — NVIDIA ou Gemini — e, se ela
// falhar (limite de uso, fora do ar, chave errada, demora), a outra que tiver
// chave assume na hora. Testado em llm.test.ts.

import {
  GEMINI_DEFAULT_MODEL,
  NVIDIA_DEFAULT_MODEL,
  PROVIDER_LABEL,
  nvidiaChat,
  nvidiaComplete,
  nvidiaStreamStart,
  type ChatProvider,
} from "@/lib/nvidia"

export type LlmSettings = {
  aiProvider?: string | null
  nvidiaApiKey?: string | null
  nvidiaModel?: string | null
  geminiApiKey?: string | null
  geminiModel?: string | null
}

export type LlmTarget = { provider: ChatProvider; apiKey: string; model: string }

/** IAs com chave, na ordem de uso: a escolhida primeiro, a outra de reserva. */
export function llmTargets(s: LlmSettings): LlmTarget[] {
  const all: Record<ChatProvider, LlmTarget> = {
    nvidia: { provider: "nvidia", apiKey: (s.nvidiaApiKey ?? "").trim(), model: (s.nvidiaModel ?? "").trim() || NVIDIA_DEFAULT_MODEL },
    gemini: { provider: "gemini", apiKey: (s.geminiApiKey ?? "").trim(), model: (s.geminiModel ?? "").trim() || GEMINI_DEFAULT_MODEL },
  }
  const order: ChatProvider[] = s.aiProvider === "gemini" ? ["gemini", "nvidia"] : ["nvidia", "gemini"]
  return order.map((p) => all[p]).filter((t) => t.apiKey)
}

export const NO_KEY = "Cadastre a chave da NVIDIA ou do Gemini em Configurações → Inteligência artificial"

/**
 * Roda com a primeira IA; se der erro, tenta a próxima. Cancelamento de quem
 * chamou (a tela fechou) não troca de IA. Se todas falharem, devolve o erro
 * da primeira (a escolhida), que é o que a dona precisa consertar.
 */
export async function withLlm<T>(s: LlmSettings, run: (t: LlmTarget) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const targets = llmTargets(s)
  if (!targets.length) throw new Error(NO_KEY)
  let first: unknown
  for (const t of targets) {
    try {
      return await run(t)
    } catch (err) {
      if (signal?.aborted) throw err
      first ??= err
      // eslint-disable-next-line quality/no-direct-console -- o helper pino (src/lib/logger.ts) depende de pino-pretty, que não está instalado
      if (targets.length > 1) console.warn(`[ia] ${PROVIDER_LABEL[t.provider]} falhou, tentando a outra:`, err instanceof Error ? err.message : err)
    }
  }
  throw first
}

type Common = Omit<Parameters<typeof nvidiaChat>[0], "provider" | "apiKey" | "model">

export const llmChat = (s: LlmSettings, opts: Common) => withLlm(s, (t) => nvidiaChat({ ...opts, ...t }), opts.signal)
export const llmComplete = (s: LlmSettings, opts: Common) => withLlm(s, (t) => nvidiaComplete({ ...opts, ...t }), opts.signal)
/** Resposta aos pedaços: a troca de IA só acontece antes do primeiro pedaço. */
export const llmStreamStart = (s: LlmSettings, opts: Common) => withLlm(s, (t) => nvidiaStreamStart({ ...opts, ...t }), opts.signal)
