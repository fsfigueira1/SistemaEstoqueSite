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
    return Array.isArray(list) ? list.filter((i) => i && i.id && i.qty > 0) : [];
  } catch {
    return [];
  }
}
