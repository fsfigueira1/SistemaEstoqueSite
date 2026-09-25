// Sugestão de compra — regra pura (sem banco), testada em restock.test.ts.
//
// Para cada produto ativo:
//   venda por dia  = vendido no período ÷ dias do período
//   estoque alvo   = venda por dia × dias a cobrir + estoque mínimo (folga)
//                    (limitado ao estoque máximo, quando cadastrado)
//   comprar        = estoque alvo − estoque atual (se positivo)
// Entra na lista quem precisa comprar algo. Agrupado por fornecedor, com os
// mais urgentes (que acabam antes) primeiro.

export type RestockProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  stock: number
  min: number
  max: number | null
  cost: number
  unit: string | null
  supplier: { id: string; name: string; phone: string | null; contactName: string | null } | null
}

export type RestockItem = {
  productId: string
  name: string
  code: string | null
  unit: string | null
  sold: number
  perDay: number
  stock: number
  min: number
  /** Dias até acabar no ritmo atual (null = não vendeu no período). */
  daysLeft: number | null
  suggested: number
  cost: number
  subtotal: number
  urgency: "out" | "soon" | "low" | "ok"
}

export type RestockGroup = {
  supplier: RestockProduct["supplier"]
  items: RestockItem[]
  units: number
  cost: number
}

export type RestockPlan = {
  days: number
  cover: number
  groups: RestockGroup[]
  summary: { products: number; units: number; cost: number }
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function suggestQuantity(p: { stock: number; min: number; max: number | null }, sold: number, days: number, cover: number): number {
  const perDay = days > 0 ? sold / days : 0
  let target = Math.ceil(perDay * cover) + Math.max(0, p.min)
  if (p.max && p.max > 0) target = Math.min(target, p.max)
  return Math.max(0, target - Math.max(0, p.stock))
}

function urgencyOf(stock: number, min: number, daysLeft: number | null): RestockItem["urgency"] {
  if (stock <= 0) return "out"
  if (daysLeft != null && daysLeft <= 7) return "soon"
  if (stock <= min) return "low"
  return "ok"
}

export function buildRestockPlan(products: RestockProduct[], soldById: Map<string, number>, days: number, cover: number): RestockPlan {
  const groups = new Map<string, RestockGroup>()
  for (const p of products) {
    const sold = soldById.get(p.id) ?? 0
    const suggested = suggestQuantity(p, sold, days, cover)
    if (suggested <= 0) continue
    const perDay = days > 0 ? sold / days : 0
    const daysLeft = perDay > 0 ? Math.floor(Math.max(0, p.stock) / perDay) : null
    const item: RestockItem = {
      productId: p.id,
      name: p.name,
      code: p.barcode || p.sku || null,
      unit: p.unit,
      sold,
      perDay: r2(perDay),
      stock: p.stock,
      min: p.min,
      daysLeft,
      suggested,
      cost: r2(p.cost),
      subtotal: r2(p.cost * suggested),
      urgency: urgencyOf(p.stock, p.min, daysLeft),
    }
    const key = p.supplier?.id ?? ""
    const g = groups.get(key) ?? { supplier: p.supplier, items: [], units: 0, cost: 0 }
    g.items.push(item)
    g.units += suggested
    g.cost = r2(g.cost + item.subtotal)
    groups.set(key, g)
  }

  const rank = { out: 0, soon: 1, low: 2, ok: 3 } as const
  const list = [...groups.values()]
  for (const g of list) {
    g.items.sort(
      (a, b) =>
        rank[a.urgency] - rank[b.urgency] ||
        (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) ||
        b.sold - a.sold ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
  }
  // fornecedores por nome; "sem fornecedor" por último
  list.sort((a, b) => {
    if (!a.supplier) return 1
    if (!b.supplier) return -1
    return a.supplier.name.localeCompare(b.supplier.name, "pt-BR")
  })

  return {
    days,
    cover,
    groups: list,
    summary: {
      products: list.reduce((n, g) => n + g.items.length, 0),
      units: list.reduce((n, g) => n + g.units, 0),
      cost: r2(list.reduce((n, g) => n + g.cost, 0)),
    },
  }
}

/** Só dígitos, com 55 na frente quando for número brasileiro sem DDI. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "")
  if (d.length === 10 || d.length === 11) return `55${d}`
  if (d.length >= 12 && d.length <= 13) return d
  return null
}

/** Texto do pedido para mandar ao fornecedor (WhatsApp ou copiar). */
export function orderMessage(
  store: string,
  supplier: { name: string; contactName: string | null } | null,
  items: Array<{ name: string; code: string | null; qty: number; unit?: string | null }>,
): string {
  const who = supplier?.contactName?.trim() || supplier?.name?.trim()
  const lines = items
    .filter((i) => i.qty > 0)
    .map((i) => `• ${i.qty} × ${i.name}${i.code ? ` (cód. ${i.code})` : ""}`)
  return [`Olá${who ? `, ${who}` : ""}! Segue o pedido da ${store}:`, "", ...lines, "", "Obrigada!"].join("\n")
}
