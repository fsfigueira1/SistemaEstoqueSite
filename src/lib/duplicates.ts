// Produtos possivelmente duplicados: mesmo nome (sem acento/maiúscula/pontuação),
// mesmas palavras em outra ordem, ou o código de barras de um igual ao SKU/código
// do outro. Regra pura — testada em duplicates.test.ts.
import { norm, tokens } from "@/lib/schoolList"

export type DupProduct = { id: string; name: string; barcode: string | null; sku: string | null }
export type DupGroup = { reason: string; ids: string[] }

const nameKey = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").trim()
const wordsKey = (s: string) => [...new Set(tokens(s))].sort().join(" ")

export function findDuplicates(products: DupProduct[]): DupGroup[] {
  const parent = new Map<string, string>()
  const reason = new Map<string, Set<string>>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const join = (a: string, b: string, why: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
    for (const id of [a, b]) {
      if (!reason.has(id)) reason.set(id, new Set())
      reason.get(id)?.add(why)
    }
  }
  const index = (key: (p: DupProduct) => string[], why: string) => {
    const seen = new Map<string, string>()
    for (const p of products) {
      for (const k of key(p)) {
        if (!k) continue
        const first = seen.get(k)
        if (first && first !== p.id) join(first, p.id, why)
        else seen.set(k, p.id)
      }
    }
  }
  index((p) => [nameKey(p.name)], "mesmo nome")
  index((p) => [wordsKey(p.name).length >= 8 ? wordsKey(p.name) : ""], "mesmas palavras no nome")
  index((p) => [...new Set([p.barcode, p.sku].map((c) => (c ?? "").trim()).filter((c) => c.length >= 6))], "mesmo código")

  const groups = new Map<string, string[]>()
  for (const p of products) {
    if (!reason.has(p.id)) continue
    const r = find(p.id)
    groups.set(r, [...(groups.get(r) ?? []), p.id])
  }
  return [...groups.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => ({ ids, reason: [...new Set(ids.flatMap((id) => [...(reason.get(id) ?? [])]))].join(" · ") }))
}
