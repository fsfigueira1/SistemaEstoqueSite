'use client';

// Itens que outra tela (ex.: Lista escolar) manda para o carrinho do PDV.
// Fica no navegador deste computador até o PDV abrir e pegar.

export type PrefillItem = { id: string; name: string; code: string; price: number; stock: number; qty: number };

const KEY = 'lacolaria:pdvPrefill';

export function sendToPdv(items: PrefillItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* sem armazenamento: nada a fazer */
  }
}

/** Lê e apaga (só entra uma vez no carrinho). */
export function takePdvPrefill(): PrefillItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    const list = raw ? (JSON.parse(raw) as PrefillItem[]) : [];
    if (!Array.isArray(list)) return [];
    // um produto = uma linha no carrinho
    const byId = new Map<string, PrefillItem>();
    for (const i of list) {
      if (!i || !i.id || !(i.qty > 0)) continue;
      const cur = byId.get(i.id);
      if (cur) cur.qty = Math.min(cur.stock, cur.qty + i.qty);
      else byId.set(i.id, { ...i, qty: Math.min(i.stock, i.qty) });
    }
    return [...byId.values()].filter((i) => i.qty > 0);
  } catch {
    return [];
  }
}
