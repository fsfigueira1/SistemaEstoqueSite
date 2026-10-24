import { describe, it, expect } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const L = require("../../electron/waAutoLogic.cjs") as typeof import("../../electron/waAutoLogic.cjs")

const MIN = 60_000

describe("regras do robô de resposta automática", () => {
  it("atraso sorteado entre 4 e 7 minutos", () => {
    expect(L.pickDelayMs(() => 0)).toBe(4 * MIN)
    expect(L.pickDelayMs(() => 0.999999)).toBeLessThan(7 * MIN)
    expect(L.pickDelayMs(() => 0.5)).toBe(5.5 * MIN)
  })

  it("limite de respostas na última hora", () => {
    const now = 10 * 60 * MIN
    const sent = [now - 61 * MIN, now - 30 * MIN, now - 1 * MIN]
    expect(L.rateOk(sent, now, 3)).toBe(true) // a de 61 min atrás já não conta
    expect(L.rateOk(sent, now, 2)).toBe(false)
  })

  it("a mesma pessoa não recebe duas respostas automáticas em menos de 10 minutos", () => {
    expect(L.chatCooldownOk(undefined, 0)).toBe(true)
    expect(L.chatCooldownOk(0, 9 * MIN)).toBe(false)
    expect(L.chatCooldownOk(0, 10 * MIN)).toBe(true)
  })

  it("só mexe no WhatsApp quando o atendente está parado há 90 segundos", () => {
    expect(L.userIdle(0, 89_000)).toBe(false)
    expect(L.userIdle(0, 90_000)).toBe(true)
  })

  it("fila: entra quem tem não lida; sai quem alguém da loja abriu antes da hora", () => {
    const q = new Map<string, { name: string; dueAt: number; unread?: number }>()
    L.syncQueue(q, [{ name: "Ana", unread: 2 }, { name: "Bruno", unread: 0 }], 1000, () => 0)
    expect([...q.keys()]).toEqual(["Ana"])
    expect(q.get("Ana")!.dueAt).toBe(1000 + 4 * MIN)
    // nova volta: Ana continua com não lida (não sorteia de novo); Bruno mandou mensagem
    L.syncQueue(q, [{ name: "Ana", unread: 3 }, { name: "Bruno", unread: 1 }], 5000, () => 0.5)
    expect(q.get("Ana")!.dueAt).toBe(1000 + 4 * MIN)
    expect(q.get("Ana")!.unread).toBe(3) // guarda quantas são novas (o robô lê só essas)
    expect(q.get("Bruno")!.dueAt).toBe(5000 + 5.5 * MIN)
    // o atendente abriu a conversa da Ana (zerou as não lidas): sai da fila
    L.syncQueue(q, [{ name: "Ana", unread: 0 }, { name: "Bruno", unread: 1 }], 9000, () => 0)
    expect([...q.keys()]).toEqual(["Bruno"])
  })

  it("próxima da fila: a mais antiga que já venceu", () => {
    const q = new Map([
      ["A", { name: "A", dueAt: 500 }],
      ["B", { name: "B", dueAt: 100 }],
      ["C", { name: "C", dueAt: 9000 }],
    ])
    expect(L.nextDue(q, 1000)?.name).toBe("B")
    expect(L.nextDue(q, 50)).toBeNull()
  })
})
