'use client';

import { useEffect, useState } from 'react';
import { refreshProductCache, cacheInfo } from '@/lib/offline/productCache';
import { flushQueue } from '@/lib/offline/sync';
import { queueCount } from '@/lib/offline/saleQueue';

const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // reatualiza o catálogo no máx. a cada 5 min
const TICK_MS = 45 * 1000;

async function refreshCacheIfStale() {
  try {
    const { count, syncedAt } = await cacheInfo();
    if (count === 0 || !syncedAt || Date.now() - syncedAt > CACHE_MAX_AGE_MS) {
      await refreshProductCache();
    }
  } catch {
    /* offline ou IndexedDB bloqueado — ignora */
  }
}

/**
 * Montado no layout. Mantém o cache do catálogo fresco e escoa a fila de
 * vendas offline quando há internet. Não renderiza nada.
 */
export default function OfflineSync() {
  useEffect(() => {
    let alive = true;

    const cycle = async () => {
      if (!alive) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      await refreshCacheIfStale();
      try {
        await flushQueue();
      } catch {
        /* ignora */
      }
    };

    cycle();
    const onOnline = () => cycle();
    window.addEventListener('online', onOnline);
    const iv = setInterval(cycle, TICK_MS);

    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
      clearInterval(iv);
    };
  }, []);

  return null;
}

/** Estado de conexão + quantas vendas estão na fila local. Para badges na UI. */
export function useOfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const refresh = () => {
      queueCount()
        .then(setPending)
        .catch(() => {});
    };
    refresh();
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('lacolaria:queue-changed', refresh);
    const iv = setInterval(refresh, 10000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('lacolaria:queue-changed', refresh);
      clearInterval(iv);
    };
  }, []);

  return { online, pending };
}
