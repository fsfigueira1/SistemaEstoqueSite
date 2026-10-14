// Busca o catálogo inteiro, página por página. Antes as telas pediam
// "?limit=1000" e, passando de 1000 produtos, o resto sumia da lista sem aviso.
// Devolve o mesmo formato da API ({ success, data: { products } }) para as
// telas trocarem a chamada sem mudar o resto.
const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // trava de segurança: 50 mil produtos

export async function fetchAllProducts<T = unknown>(): Promise<{ success: boolean; data: { products: T[] } }> {
  const products: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetch(`/api/products?limit=${PAGE_SIZE}&page=${page}`).then((x) => x.json());
    if (!r?.success) return { success: false, data: { products } };
    const batch: T[] = r.data?.products ?? [];
    products.push(...batch);
    const total = Number(r.data?.pagination?.total ?? 0);
    if (batch.length < PAGE_SIZE || products.length >= total) break;
  }
  return { success: true, data: { products } };
}
