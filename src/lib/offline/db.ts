// IndexedDB do PDV offline: cache do catálogo + fila de vendas.
// Tudo aqui é seguro de importar no servidor (as funções retornam vazio/no-op
// quando não há IndexedDB).
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lacolaria-offline';
const DB_VERSION = 1;

export type CachedProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  salePrice: number;
  stockQuantity: number;
  status: string;
  categoryId: string | null;
};

export type QueuedSale = {
  clientId: string;
  occurredAt: string; // ISO
  payload: Record<string, unknown>; // corpo do POST /api/sales/checkout
  status: 'pending' | 'failed';
  error?: string;
  attempts: number;
  createdAt: string; // ISO
};

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('barcode', 'barcode');
        }
        if (!db.objectStoreNames.contains('saleQueue')) {
          db.createObjectStore('saleQueue', { keyPath: 'clientId' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    }).catch((err) => {
      // modo privado / storage bloqueado: desliga o offline em vez de quebrar a
      // página. Os callers tratam o null/erro e seguem sem cache.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// Avisa a UI (badge de pendentes) que a fila mudou.
export function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lacolaria:queue-changed'));
  }
}

export function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
