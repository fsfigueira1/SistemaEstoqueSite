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
  it("lê nome e mensagens: loja pelo tracinho de status, cliente sem ele", () => {
    expect(dom.readOpenChat(page())).toEqual({
      ok: true,
      name: "Ana Souza",
      phone: "",
      group: false,
      messages: [
        { from: "cliente", text: "Oi! Vocês têm caderno?" },
        { from: "loja", text: "Temos sim! Me manda a lista 😊" },
        { from: "cliente", text: "2 cadernos 96 folhas\n1 borracha" },
        { from: "cliente", text: "3 lápis preto" },
      ],
    })
  })

  it("mensagem da loja sem a ponta da bolha (agrupada) continua sendo da loja", () => {
    const html = FIXTURE.replace('<span data-testid="tail-out" data-icon="tail-out"><svg><title>tail-out</title></svg></span>', "").replace('<span aria-label="Você:"></span>', "")
    const r = dom.readOpenChat(page(html))
    if (!r.ok) throw new Error("devia ler")
    expect(r.messages[1]).toEqual({ from: "loja", text: "Temos sim! Me manda a lista 😊" })
  })

  it("nome vem do campo de digitar; número sem nome vira telefone", () => {
    const semCabecalho = FIXTURE.replace('<span dir="auto" title="Ana Souza">Ana Souza</span>', "")
    expect(dom.readOpenChat(page(semCabecalho))).toMatchObject({ name: "Ana Souza" })
    const numero = FIXTURE.replace("Digite uma mensagem para Ana Souza", "Digite uma mensagem para +55 17 98888-7777")
    expect(dom.readOpenChat(page(numero))).toMatchObject({ name: "", phone: "5517988887777" })
  })

  it("grupo: mensagens recebidas de pessoas diferentes", () => {
    const html = FIXTURE.replace('data-pre-plain-text="[10:05, 22/10/2026] Ana Souza: ">\n                <span class="selectable-text copyable-text" data-testid="selectable-text"><span>3 lápis', 'data-pre-plain-text="[10:05, 22/10/2026] Bruno: ">\n                <span class="selectable-text copyable-text" data-testid="selectable-text"><span>3 lápis')
    expect(dom.readOpenChat(page(html))).toMatchObject({ group: true })
  })

  it("pega só o que o cliente mandou depois da última resposta da loja", () => {
    const r = dom.readOpenChat(page())
    if (!r.ok) throw new Error("devia ler")
    expect(dom.customerTurn(r.messages)).toBe("2 cadernos 96 folhas\n1 borracha\n3 lápis preto")
    const only = Array.from({ length: 9 }, (_, i) => ({ from: "cliente" as const, text: `m${i}` }))
    expect(dom.customerTurn(only)).toBe("m3\nm4\nm5\nm6\nm7\nm8")
  })

  it("foto/áudio do cliente: entra como mídia (sem texto) e não vai para a resposta", () => {
    const foto = `<div tabindex="-1" data-testid="conv-msg-3EB0EEEE5555"><div data-testid="msg-container"><span data-icon="tail-in"></span><div role="button" aria-label="Abrir imagem"><img src="blob:https://web.whatsapp.com/abc" /></div><div data-testid="msg-meta"><span>10:06</span></div></div></div>`
    const html = FIXTURE.replace("        </div>\n        <footer>", `          ${foto}\n        </div>\n        <footer>`)
    const r = dom.readOpenChat(page(html))
    if (!r.ok) throw new Error("devia ler")
    expect(r.messages.at(-1)).toEqual({ from: "cliente", text: "", media: true })
    expect(dom.newMedia(r.messages, 1)).toBe(true)
    expect(dom.newMedia(r.messages.slice(0, -1), 1)).toBe(false)
    expect(dom.customerTurn(r.messages, 2)).toBe("3 lápis preto")
  })

  it("robô: só as mensagens novas (não lidas), nunca uma antiga junto", () => {
    const msgs = [
      { from: "cliente" as const, text: "pedido antigo do site" },
      { from: "cliente" as const, text: "Que horas abrem amanhã?" },
    ]
    expect(dom.customerTurn(msgs, 1)).toBe("Que horas abrem amanhã?")
    expect(dom.customerTurn(msgs, 2)).toBe("pedido antigo do site\nQue horas abrem amanhã?")
  })

  it("sem conversa aberta", () => {
    expect(dom.readOpenChat(page('<div id="app"><div id="side"></div></div>'))).toEqual({ ok: false, reason: "sem-conversa" })
    expect(dom.readOpenChat(page('<div id="app"><div>Escaneie para entrar</div></div>'))).toEqual({ ok: false, reason: "nao-conectado" })
  })
})

describe("lista de conversas e ações", () => {
  it("lista as conversas com quantas não lidas", () => {
    expect(dom.listChats(page())).toEqual([
      { name: "Ana Souza", unread: 2 },
      { name: "+55 17 98888-7777", unread: 0 },
    ])
  })

  it("abre a conversa pelo nome", () => {
    const doc = page()
    let clicked = ""
    doc.querySelectorAll('[data-testid="cell-frame-container"]').forEach((el, i) =>
      el.addEventListener("mousedown", () => (clicked = i === 0 ? "Ana" : "outro")),
    )
    expect(dom.openChat(doc, "Ana Souza")).toBe(true)
    expect(clicked).toBe("Ana")
    expect(dom.openChat(doc, "Ninguém")).toBe(false)
  })

  it("abre o 'Ler mais' das mensagens longas", () => {
    const doc = page()
    let n = 0
    doc.querySelector('[data-testid="caption-read-more-button"]')!.addEventListener("click", () => n++)
    expect(dom.expandReadMore(doc)).toBe(1)
    expect(n).toBe(1)
  })

  it("enviar clica no botão Enviar (e só se ele existir)", () => {
    const doc = page()
    let sent = false
    doc.querySelector('button[aria-label="Enviar"]')!.addEventListener("click", () => (sent = true))
    expect(dom.sendCompose(doc)).toBe(true)
    expect(sent).toBe(true)
    expect(dom.sendCompose(page(FIXTURE.replace('aria-label="Enviar"', 'aria-label="Mensagem de voz"')))).toBe(false)
  })
})

describe("telefone e conferência da conversa", () => {
  it("sameChat: mesma pessoa pelo telefone, senão pelo nome", () => {
    const ana = { name: "Ana Souza", phone: "5517999998888" }
    expect(dom.sameChat(ana, { name: "Ana Souza", phone: "5517999998888" })).toBe(true)
    expect(dom.sameChat(ana, { name: "Ana", phone: "5517999998888" })).toBe(true)
    expect(dom.sameChat(ana, { name: "Ana Souza", phone: "5517911112222" })).toBe(false)
    expect(dom.sameChat({ name: "Ana Souza", phone: "" }, { name: " ana souza ", phone: "" })).toBe(true)
    expect(dom.sameChat({ name: "Ana Souza", phone: "" }, { name: "Bruno", phone: "" })).toBe(false)
    expect(dom.sameChat({ name: "", phone: "" }, { name: "", phone: "" })).toBe(false)
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
    const code2 = dom.toScript(dom.openChat, 'nome com "aspas"')
    expect(code2).toContain(JSON.stringify('nome com "aspas"'))
  })
})
