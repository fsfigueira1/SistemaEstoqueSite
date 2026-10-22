import { describe, it, expect } from "vitest"
import { publicSettings, type ServerSettings } from "./serverSettings"

describe("publicSettings", () => {
  it("nunca devolve chaves de API, só se existem e o final", () => {
    const s = {
      id: "app",
      companyName: "L",
      aiApiKey: "sk-ant-123456789",
      shoppingApiKey: "",
      nvidiaApiKey: "nvapi-abcdefghij",
    } as unknown as ServerSettings
    const p = publicSettings(s) as Record<string, unknown>
    expect(JSON.stringify(p)).not.toContain("nvapi-abcdefghij")
    expect(JSON.stringify(p)).not.toContain("sk-ant-123456789")
    expect(p).toMatchObject({ companyName: "L", aiKeySet: true, nvidiaKeySet: true, nvidiaKeyHint: "…ghij", shoppingKeySet: false })
  })
})
