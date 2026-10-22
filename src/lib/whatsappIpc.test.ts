import { describe, it, expect } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ipc = require("../../electron/whatsappIpc.cjs") as typeof import("../../electron/whatsappIpc.cjs")

describe("validação do IPC do WhatsApp", () => {
  it("aceita só retângulo numérico, não negativo e de tamanho razoável", () => {
    expect(ipc.validBounds({ x: 10.4, y: 20.6, width: 600, height: 500 })).toEqual({ x: 10, y: 21, width: 600, height: 500 })
    expect(ipc.validBounds({ x: -1, y: 0, width: 100, height: 100 })).toBeNull()
    expect(ipc.validBounds({ x: 0, y: 0, width: "100", height: 100 })).toBeNull()
    expect(ipc.validBounds({ x: 0, y: 0, width: 50000, height: 100 })).toBeNull()
    expect(ipc.validBounds(null)).toBeNull()
  })

  it("texto só string até 8000 caracteres", () => {
    expect(ipc.validText("oi")).toBe("oi")
    expect(ipc.validText("x".repeat(8001))).toBeNull()
    expect(ipc.validText(42)).toBeNull()
  })

  it("só navega dentro do web.whatsapp.com", () => {
    expect(ipc.isWhatsAppUrl("https://web.whatsapp.com/")).toBe(true)
    expect(ipc.isWhatsAppUrl("https://web.whatsapp.com/send?phone=1")).toBe(true)
    expect(ipc.isWhatsAppUrl("https://web.whatsapp.com.evil.com/")).toBe(false)
    expect(ipc.isWhatsAppUrl("http://web.whatsapp.com/")).toBe(false)
  })
})
