'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAllProducts } from '@/lib/fetchAllProducts';
import type { LabelCategory, LabelInfoDto, LabelInfoMap, LabelProduct } from './labelProducts';

/** Produtos, categorias e a situação das etiquetas (promoção / reimprimir). */
export function useLabelCatalog() {
  const [products, setProducts] = useState<LabelProduct[]>([]);
  const [categories, setCategories] = useState<LabelCategory[]>([]);
  const [info, setInfo] = useState<LabelInfoMap>(() => new Map());
  const [loading, setLoading] = useState(true);

  const reloadInfo = useCallback(async () => {
    try {
      const r = await fetch('/api/labels').then((x) => x.json());
      if (r?.success) setInfo(new Map((r.data as LabelInfoDto[]).map((i) => [i.productId, i])));
    } catch {
      /* sem a situação das etiquetas a tela continua funcionando */
    }
  }, []);

  const reloadProducts = useCallback(async () => {
    const p = await fetchAllProducts<LabelProduct>();
    if (p.success) setProducts(p.data.products);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [, c] = await Promise.all([
          reloadProducts(),
          fetch('/api/categories').then((r) => r.json()),
          reloadInfo(),
        ]);
        if (c.success) setCategories(c.data?.categories ?? c.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadProducts, reloadInfo]);

  return { products, categories, info, loading, reloadInfo, reloadProducts };
}
