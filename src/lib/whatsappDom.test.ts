// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { JSDOM } from "jsdom"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dom = require("../../electron/whatsappDom.cjs") as typeof import("../../electron/whatsappDom.cjs")

const FIXTURE = readFileSync(join(__dirname, "__fixtures__", "whatsapp-chat.html"), "utf8")
const page = (html = FIXTURE) => new JSDOM(html).window.document

describe("readOpenChat", () => {
  it("lê nome, telefone e mensagens", () => {
    const r = dom.readOpenChat(page())
    expect(r).toEqual({
      ok: true,
      name: "Ana Souza",
      phone: "5517999998888",
      messages: [
        { from: "cliente", text: "Oi! Vocês têm caderno?" },
        { from: "loja", text: "Temos sim! Me manda a lista 😊" },
        { from: "cliente", text: "2 cadernos 96 folhas" },
        { from: "cliente", text: "3 lápis preto" },
      ],
    })
  })

  it("pega só o que o cliente mandou depois da última resposta da loja", () => {
    const r = dom.readOpenChat(page())
    if (!r.ok) throw new Error("devia ler")
    expect(dom.customerTurn(r.messages)).toBe("2 cadernos 96 folhas\n3 lápis preto")
    const only = Array.from({ length: 9 }, (_, i) => ({ from: "cliente" as const, text: `m${i}` }))
    expect(dom.customerTurn(only)).toBe("m3\nm4\nm5\nm6\nm7\nm8")
  })

  it("sem telefone quando o id não é número", () => {
    const html = FIXTURE.replace(/false_5517999998888@c\.us/g, "false_123456789012345@lid").replace(/true_5517999998888@c\.us/g, "true_123456789012345@lid")
    const r = dom.readOpenChat(page(html))
    expect(r).toMatchObject({ ok: true, name: "Ana Souza", phone: "" })
    const titled = html.replace(/title="Ana Souza">Ana Souza/, 'title="+55 17 98888-7777">+55 17 98888-7777')
    expect(dom.readOpenChat(page(titled))).toMatchObject({ phone: "5517988887777" })
  })

  it("sem conversa aberta", () => {
    expect(dom.readOpenChat(page('<div id="app"><div id="side"></div></div>'))).toEqual({ ok: false, reason: "sem-conversa" })
    expect(dom.readOpenChat(page('<div id="app"><canvas aria-label="Scan this QR code to link a device!"></canvas><div data-ref="2@abc"></div></div>'))).toEqual({
      ok: false,
      reason: "nao-conectado",
    })
  })
})

describe("insertIntoCompose", () => {
  it("insere texto com quebras de linha", () => {
    const doc = page()
    const box = doc.querySelector("#main footer div[contenteditable=true]") as HTMLElement
    let pasted = ""
    box.addEventListener("paste", (e) => {
      pasted = (e as ClipboardEvent).clipboardData?.getData("text/plain") ?? ""
    })
    expect(dom.insertIntoCompose(doc, "Oi, Ana! 😊\n\nOrçamento:\n• 2 × Caderno")).toBe(true)
    expect(pasted).toBe("Oi, Ana! 😊\n\nOrçamento:\n• 2 × Caderno")
    expect(dom.insertIntoCompose(page('<div id="main"></div>'), "x")).toBe(false)
  })
})

describe("toScript", () => {
  it("gera código executável", () => {
    const doc = page()
    const code = dom.toScript(dom.readOpenChat)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const r = new Function("document", `return ${code}`)(doc)
    expect(r).toMatchObject({ ok: true, name: "Ana Souza" })
    const code2 = dom.toScript(dom.insertIntoCompose, 'texto com "aspas"\ne quebra')
    expect(code2).toContain(JSON.stringify('texto com "aspas"\ne quebra'))
  })
})
