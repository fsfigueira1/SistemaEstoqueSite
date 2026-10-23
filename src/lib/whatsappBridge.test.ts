import { describe, it, expect } from "vitest"
import { sameCustomer, visibleBounds } from "./whatsappBridge"

describe("sameCustomer", () => {
  it("só substitui o orçamento se for o mesmo cliente", () => {
    expect(sameCustomer({ name: "Ana", phone: "5517999998888" }, { name: "Ana Souza", phone: "(17) 99999-8888" })).toBe(true)
    expect(sameCustomer({ name: "Ana", phone: "5517999998888" }, { name: "Ana", phone: "5517911112222" })).toBe(false)
    expect(sameCustomer({ name: "Ana Souza", phone: "" }, { name: "ana souza", phone: "" })).toBe(true)
    expect(sameCustomer({ name: "Ana Souza", phone: "" }, { name: "Bruno", phone: "" })).toBe(false)
    expect(sameCustomer({ name: "", phone: "" }, { name: "", phone: "" })).toBe(false)
  })

  it("área do WhatsApp recortada pela parte visível da janela", () => {
    expect(visibleBounds({ x: 10, y: 100, width: 500, height: 600 }, { width: 1200, height: 800 })).toEqual({ x: 10, y: 100, width: 500, height: 600 })
    expect(visibleBounds({ x: 10, y: -200, width: 500, height: 600 }, { width: 1200, height: 800 })).toEqual({ x: 10, y: 0, width: 500, height: 400 })
    expect(visibleBounds({ x: 10, y: 500, width: 500, height: 600 }, { width: 1200, height: 800 })).toEqual({ x: 10, y: 500, width: 500, height: 300 })
    expect(visibleBounds({ x: 10, y: -580, width: 500, height: 600 }, { width: 1200, height: 800 })).toBeNull()
  })
})
