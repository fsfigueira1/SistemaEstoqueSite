import { describe, it, expect } from "vitest"
import { buildRestockPlan, orderMessage, suggestQuantity, whatsappNumber, type RestockProduct } from "./restock"

const sup = (id: string, name: string) => ({ id, name, phone: "(11) 98765-4321", contactName: null })
const prod = (over: Partial<RestockProduct>): RestockProduct => ({
  id: "p",
  name: "Produto",
  sku: null,
  barcode: null,
  stock: 0,
  min: 5,
  max: 1000,
  cost: 1,
  unit: "unidade",
  supplier: null,
  ...over,
})

describe("sugestão de compra", () => {
  it("compra o que vendeu no período + a folga do mínimo, menos o que tem", () => {
    // 30 vendidas em 30 dias = 1/dia; cobrir 30 dias + mínimo 5 = 35; tem 10 → comprar 25
    expect(suggestQuantity({ stock: 10, min: 5, max: 1000 }, 30, 30, 30)).toBe(25)
    // não vendeu, mas está abaixo do mínimo → completa o mínimo
    expect(suggestQuantity({ stock: 2, min: 5, max: 1000 }, 0, 30, 30)).toBe(3)
    // não vendeu e tem estoque → nada
    expect(suggestQuantity({ stock: 10, min: 5, max: 1000 }, 0, 30, 30)).toBe(0)
    // respeita o estoque máximo
    expect(suggestQuantity({ stock: 0, min: 5, max: 20 }, 300, 30, 30)).toBe(20)
    // estoque negativo conta como zero
    expect(suggestQuantity({ stock: -3, min: 2, max: null }, 0, 30, 30)).toBe(2)
  })

  it("agrupa por fornecedor, urgentes primeiro, sem fornecedor no fim", () => {
    const plan = buildRestockPlan(
      [
        prod({ id: "a", name: "Caneta", stock: 20, supplier: sup("s2", "Zeta Distribuidora"), cost: 2 }),
        prod({ id: "b", name: "Caderno", stock: 0, supplier: sup("s1", "Alfa Papéis"), cost: 10 }),
        prod({ id: "c", name: "Lápis", stock: 3, supplier: sup("s1", "Alfa Papéis"), cost: 1 }),
        prod({ id: "d", name: "Laço", stock: 1, supplier: null }),
        prod({ id: "e", name: "Parado", stock: 50 }),
      ],
      new Map([
        ["a", 60],
        ["b", 15],
        ["c", 30],
      ]),
      30,
      30,
    )
    expect(plan.groups.map((g) => g.supplier?.name ?? "—")).toEqual(["Alfa Papéis", "Zeta Distribuidora", "—"])
    const alfa = plan.groups[0]
    expect(alfa.items.map((i) => i.name)).toEqual(["Caderno", "Lápis"])
    expect(alfa.items[0]).toMatchObject({ urgency: "out", suggested: 20, subtotal: 200 })
    expect(alfa.items[1]).toMatchObject({ urgency: "soon", daysLeft: 3, suggested: 32 })
    expect(plan.groups[1].items[0]).toMatchObject({ daysLeft: 10, suggested: 45 })
    expect(plan.summary.products).toBe(4)
    expect(plan.groups.flatMap((g) => g.items).some((i) => i.name === "Parado")).toBe(false)
  })

  it("monta a mensagem e o número do WhatsApp", () => {
    expect(whatsappNumber("(11) 98765-4321")).toBe("5511987654321")
    expect(whatsappNumber("+55 11 98765-4321")).toBe("5511987654321")
    expect(whatsappNumber("123")).toBeNull()
    const msg = orderMessage("Laçolaria", { name: "Alfa", contactName: "Marta" }, [
      { name: "Caderno", code: "789", qty: 20 },
      { name: "Lápis", code: null, qty: 0 },
    ])
    expect(msg).toContain("Olá, Marta! Segue o pedido da Laçolaria:")
    expect(msg).toContain("• 20 × Caderno (cód. 789)")
    expect(msg).not.toContain("Lápis")
  })
})
