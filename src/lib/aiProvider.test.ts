import { describe, it, expect } from "vitest"
import { pickAiProvider } from "./aiProvider"

describe("pickAiProvider (quem lê a foto da lista)", () => {
  it("usa a escolhida quando tem chave, senão a outra que tiver", () => {
    expect(pickAiProvider({ aiProvider: "nvidia", nvidiaApiKey: "<n>", aiApiKey: "<c>" })).toBe("llm")
    expect(pickAiProvider({ aiProvider: "gemini", geminiApiKey: "<g>", aiApiKey: "<c>" })).toBe("llm")
    expect(pickAiProvider({ aiProvider: "claude", nvidiaApiKey: "<n>", aiApiKey: "<c>" })).toBe("claude")
    expect(pickAiProvider({ aiProvider: "nvidia", nvidiaApiKey: " ", aiApiKey: "<c>" })).toBe("claude")
    expect(pickAiProvider({ aiProvider: "claude", geminiApiKey: "<g>", aiApiKey: "" })).toBe("llm")
    expect(pickAiProvider({ aiProvider: "nvidia", nvidiaApiKey: "", aiApiKey: "" })).toBeNull()
  })
})
