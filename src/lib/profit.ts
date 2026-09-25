// Lucro sobre o custo (markup) e preço mínimo para bater a meta.
// Ex.: custo R$ 10,00, meta 110% → preço a partir de R$ 21,00 (R$ 21,90 na prateleira).
import { shelfPriceAtLeast } from "@/lib/priceAdvice"

const r1 = (n: number) => Math.round(n * 10) / 10

/** Lucro em % sobre o custo. null quando não há custo. */
export function profitPercent(cost: number | null | undefined, price: number | null | undefined): number | null {
  const c = Number(cost)
  const p = Number(price)
  if (!(c > 0) || !(p >= 0)) return null
  return r1(((p - c) / c) * 100)
}

/** Menor preço "de prateleira" (,50/,90) que dá pelo menos a meta de lucro. */
export function priceForTarget(cost: number | null | undefined, targetPercent: number): number | null {
  const c = Number(cost)
  if (!(c > 0)) return null
  return shelfPriceAtLeast(Math.ceil(c * (1 + targetPercent / 100) * 100 - 1e-6) / 100)
}

export function meetsTarget(cost: number | null | undefined, price: number | null | undefined, targetPercent: number): boolean | null {
  const p = profitPercent(cost, price)
  return p == null ? null : p >= targetPercent - 0.05
}
