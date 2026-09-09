// Cache local do catálogo (produtos ativos). O PDV lê daqui para funcionar
// offline e também para responder mais rápido quando online.
import { getDB, norm, type CachedProduct } from './db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCached(p: any): CachedProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? null,
    salePrice: Number(p.salePrice) || 0,
    stockQuantity: Number(p.stockQuantity) || 0,
    status: p.status ?? 'ACTIVE',
    categoryId: p.categoryId ?? null,
  };
}

/** Baixa o catálogo ativo e substitui o cache. Retorna quantos produtos gravou. */
export async function refreshProductCache(): Promise<number> {
  const dbp = getDB();
  if (!dbp) return 0;
  const res = await fetch('/api/products?status=ACTIVE&limit=100000');
  if (!res.ok) throw new Error(`Falha ao baixar o catálogo (HTTP ${res.status})`);
  const json = await res.json();
  const list: unknown[] = json?.data?.products ?? [];

  const db = await dbp;
  const tx = db.transaction(['products', 'meta'], 'readwrite');
  await tx.objectStore('products').clear();
  for (const p of list) {
    await tx.objectStore('products').put(toCached(p));
  }
  await tx.objectStore('meta').put({ key: 'productsSyncedAt', value: Date.now() });
  await tx.done;
  return list.length;
}

/** Procura por código de barras; se não achar, tenta pelo SKU. */
export async function findByBarcode(code: string): Promise<CachedProduct | null> {
  const dbp = getDB();
  if (!dbp) return null;
  const clean = code.trim();
  if (!clean) return null;
  const db = await dbp;

  const byBarcode = (await db.getFromIndex('products', 'barcode', clean)) as CachedProduct | undefined;
  if (byBarcode) return byBarcode;

  let hit: CachedProduct | null = null;
  const tx = db.transaction('products');
  for await (const cursor of tx.store) {
    if ((cursor.value as CachedProduct).sku === clean) {
      hit = cursor.value as CachedProduct;
      break;
    }
  }
  return hit;
}

/** Busca por nome ou SKU no cache (produtos ativos). */
export async function searchProducts(term: string, limit = 8): Promise<CachedProduct[]> {
  const dbp = getDB();
  if (!dbp) return [];
  const q = norm(term);
  if (q.length < 2) return [];
  const db = await dbp;

  const out: CachedProduct[] = [];
  const tx = db.transaction('products');
  for await (const cursor of tx.store) {
    const p = cursor.value as CachedProduct;
    if (p.status === 'ACTIVE' && (norm(p.name).includes(q) || norm(p.sku).includes(q))) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Abate estoque no cache depois de uma venda offline (não deixa revender o mesmo item). */
export async function applyLocalStockDelta(
  items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  const db = await dbp;
  const tx = db.transaction('products', 'readwrite');
  for (const it of items) {
    const p = (await tx.store.get(it.productId)) as CachedProduct | undefined;
    if (p) {
      p.stockQuantity -= it.quantity;
      await tx.store.put(p);
    }
  }
  await tx.done;
}

export async function cacheInfo(): Promise<{ count: number; syncedAt: number | null }> {
  const dbp = getDB();
  if (!dbp) return { count: 0, syncedAt: null };
  const db = await dbp;
  const count = await db.count('products');
  const meta = (await db.get('meta', 'productsSyncedAt')) as { value: number } | undefined;
  return { count, syncedAt: meta?.value ?? null };
}
