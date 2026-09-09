// Fila local de vendas feitas offline. Sobe pro servidor via sync.ts.
import { getDB, notifyQueueChanged, type QueuedSale } from './db';

export async function enqueueSale(sale: {
  clientId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const dbp = getDB();
  if (!dbp) throw new Error('IndexedDB indisponível — não dá para salvar a venda offline neste navegador.');
  const db = await dbp;
  const item: QueuedSale = {
    ...sale,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  await db.put('saleQueue', item);
  notifyQueueChanged();
}

export async function listQueue(): Promise<QueuedSale[]> {
  const dbp = getDB();
  if (!dbp) return [];
  const db = await dbp;
  const all = (await db.getAll('saleQueue')) as QueuedSale[];
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromQueue(clientId: string): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  const db = await dbp;
  await db.delete('saleQueue', clientId);
  notifyQueueChanged();
}

export async function markFailed(clientId: string, error: string): Promise<void> {
  const dbp = getDB();
  if (!dbp) return;
  const db = await dbp;
  const item = (await db.get('saleQueue', clientId)) as QueuedSale | undefined;
  if (!item) return;
  item.status = 'failed';
  item.error = error;
  item.attempts += 1;
  await db.put('saleQueue', item);
  notifyQueueChanged();
}

export async function queueCount(): Promise<number> {
  const dbp = getDB();
  if (!dbp) return 0;
  const db = await dbp;
  return db.count('saleQueue');
}
