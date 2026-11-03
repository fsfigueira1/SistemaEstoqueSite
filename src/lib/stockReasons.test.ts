import { describe, it, expect } from "vitest"
import { OUT_REASONS, outReasonError, parseReasonNote, reasonNote } from "./stockReasons"

describe("motivos de saída de estoque", () => {
  it("grava e lê de volta motivo + explicação", () => {
    const n = reasonNote("perda", "  caiu da prateleira ")
    expect(n).toBe("[Perda / quebra / vencido] caiu da prateleira")
    expect(parseReasonNote(n)).toEqual({ reason: "Perda / quebra / vencido", explanation: "caiu da prateleira" })
  })

  it("observação antiga (sem colchetes) vira só explicação", () => {
    expect(parseReasonNote("Contagem de estoque")).toEqual({ reason: null, explanation: "Contagem de estoque" })
    expect(parseReasonNote(null)).toEqual({ reason: null, explanation: "" })
  })

  it("exige motivo válido e explicação", () => {
    expect(outReasonError(undefined, "x quebrou")).toBe("Escolha o motivo da saída")
    expect(outReasonError("inventado", "x quebrou")).toBe("Escolha o motivo da saída")
    expect(outReasonError("furto", "  ")).toBe("Explique por que o produto saiu do estoque")
    expect(outReasonError("furto", "sumiu da vitrine")).toBeNull()
  })

  it("perda e furto têm tipo próprio; o resto é saída manual", () => {
    const type = Object.fromEntries(OUT_REASONS.map((r) => [r.id, r.type]))
    expect(type).toMatchObject({ perda: "LOSS", furto: "THEFT", uso: "ADJUSTMENT_OUT", brinde: "ADJUSTMENT_OUT" })
  })
})
