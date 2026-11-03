// Quem lê a foto da lista: "llm" = NVIDIA/Gemini (src/lib/llm.ts, com uma de
// reserva da outra) ou o Claude, quando escolhido em Configurações e com
// chave. Sem a escolhida, a que tiver chave. Testado em aiProvider.test.ts.

export type AiProvider = "llm" | "claude"

export function pickAiProvider(s: { aiProvider?: string | null; nvidiaApiKey?: string | null; geminiApiKey?: string | null; aiApiKey?: string | null }): AiProvider | null {
  const llm = Boolean(s.nvidiaApiKey?.trim() || s.geminiApiKey?.trim())
  const claude = Boolean(s.aiApiKey?.trim())
  if (s.aiProvider === "claude") return claude ? "claude" : llm ? "llm" : null
  return llm ? "llm" : claude ? "claude" : null
}
