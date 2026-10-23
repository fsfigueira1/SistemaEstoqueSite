// Qual IA usar (foto da lista e ajudante): a escolhida em Configurações
// quando tem chave; senão a outra que tiver chave. Testado em aiProvider.test.ts.

export type AiProvider = "nvidia" | "claude"

export function pickAiProvider(s: { aiProvider?: string | null; nvidiaApiKey?: string | null; aiApiKey?: string | null }): AiProvider | null {
  const nvidia = Boolean(s.nvidiaApiKey?.trim())
  const claude = Boolean(s.aiApiKey?.trim())
  if (s.aiProvider === "claude") return claude ? "claude" : nvidia ? "nvidia" : null
  return nvidia ? "nvidia" : claude ? "claude" : null
}
