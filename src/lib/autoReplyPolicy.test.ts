import { describe, it, expect } from "vitest"
import { autoDecision, isSimpleQuestion, needsHuman, parseRange, withinHours } from "./autoReplyPolicy"

const HOURS = { waAutoWeekdays: "08:00-18:00", waAutoSaturday: "08:00-13:00", waAutoSunday: "" }
// horário de Brasília (UTC-3)
const at = (iso: string) => new Date(iso + "-03:00")

describe("horário da resposta automática", () => {
  it("lê faixas HH:MM-HH:MM e aceita vazio como fechado", () => {
    expect(parseRange("08:00-18:00")).toEqual([480, 1080])
    expect(parseRange(" 8:30 - 12:00 ")).toEqual([510, 720])
    expect(parseRange("")).toBeNull()
    expect(parseRange("18:00-08:00")).toBeNull()
    expect(parseRange("abc")).toBeNull()
  })

  it("segue o horário de Brasília por dia da semana", () => {
    expect(withinHours(at("2026-10-23T09:00:00"), HOURS)).toBe(true) // sexta
    expect(withinHours(at("2026-10-23T18:00:00"), HOURS)).toBe(false) // fechou
    expect(withinHours(at("2026-10-23T07:59:00"), HOURS)).toBe(false)
    expect(withinHours(at("2026-10-24T12:59:00"), HOURS)).toBe(true) // sábado
    expect(withinHours(at("2026-10-24T13:30:00"), HOURS)).toBe(false)
    expect(withinHours(at("2026-10-25T10:00:00"), HOURS)).toBe(false) // domingo fechado
  })
})

describe("o que a IA pode responder sozinha", () => {
  it("assunto delicado fica para o atendente", () => {
    expect(needsHuman("Quero trocar a mochila, veio com defeito")).toBe(true)
    expect(needsHuman("Vou reclamar no Procon")).toBe(true)
    expect(needsHuman("cobrança errada no cartão, quero estorno")).toBe(true)
    expect(needsHuman("2 cadernos 96 folhas")).toBe(false)
  })

  it("pergunta simples: horário, endereço, pagamento, se tem tal coisa, cumprimento", () => {
    expect(isSimpleQuestion("Que horas vocês abrem amanhã?")).toBe(true)
    expect(isSimpleQuestion("Onde fica a loja?")).toBe(true)
    expect(isSimpleQuestion("Aceita pix?")).toBe(true)
    expect(isSimpleQuestion("Vocês têm papel crepom?")).toBe(true)
    expect(isSimpleQuestion("Vocês entregam?")).toBe(true)
    expect(isSimpleQuestion("Fazem entrega em casa?")).toBe(true)
    expect(isSimpleQuestion("Vocês imprimem documento?")).toBe(true)
    expect(isSimpleQuestion("Bom dia!")).toBe(true)
    expect(isSimpleQuestion("Preciso falar com a dona sobre a festa da minha filha")).toBe(false)
    expect(isSimpleQuestion("Olá, tudo bem? Vim te informar sobre a nova maquininha")).toBe(false)
  })

  it("decisão: orçamento sempre; pergunta simples sim; resto e assunto delicado não", () => {
    expect(autoDecision("list", "2 cadernos\n1 borracha")).toEqual({ send: true })
    expect(autoDecision("site", "#ORC-SITE v1 ...")).toEqual({ send: true })
    expect(autoDecision("code", "#L-3A7K")).toEqual({ send: true })
    expect(autoDecision("other", "Que horas fecha hoje?")).toEqual({ send: true })
    expect(autoDecision("other", "Preciso falar com a dona sobre a festa")).toMatchObject({ send: false })
    expect(autoDecision("list", "2 cadernos com defeito, quero trocar")).toMatchObject({ send: false, reason: expect.stringMatching(/delicado/) })
  })
})
