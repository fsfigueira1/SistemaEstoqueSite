import { describe, it, expect } from "vitest"
import { pickAiProvider } from "./aiProvider"

describe("pickAiProvider", () => {
  it("usa a escolhida quando tem chave, senão a outra que tiver", () => {
    expect(pickAiProvider({ aiProvider: "nvidia", nvidiaApiKey: "n", aiApiKey: "c" })).toBe("nvidia")
    expect(pickAiProvider({ aiProvider: "claude", nvidiaApiKey: "n", aiApiKey: "c" })).toBe("claude")
    expect(pickAiProvider({ aiProvider: "nvidia", nvidiaApiKey: " ", aiApiKey: "c" })).toBe("claude")
    expect(pickAiProvider({ aiProvider: "claude", nvidiaApiKey: "n", aiApiKey: "" })).toBe("nvidia")
    expect(pickAiProvider({ aiProvider: "nvidia", nvidiaApiKey: "", aiApiKey: "" })).toBeNull()
  })
})
