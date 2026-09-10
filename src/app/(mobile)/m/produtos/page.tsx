'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useApi } from '@/components/mobile/useApi';
import { PageTitle, Loading, ErrorMsg, Empty } from '@/components/mobile/Shared';

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  salePrice: number | string;
  stockQuantity: number;
  status: string;
  category?: { name?: string } | null;
};

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0);

export default function MobileProdutos() {
  const [q, setQ] = useState('');
  const { data, loading, error } = useApi<{ products: Product[] }>('/api/products?limit=500');

  const list = useMemo(() => {
    const items = data?.products ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode ?? '').toLowerCase().includes(term),
    );
  }, [data, q]);

  return (
    <>
      <PageTitle>Produtos</PageTitle>
      <div className="sticky top-0 z-10 bg-background/95 px-4 pb-3 backdrop-blur">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            inputMode="search"
          />
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {!loading && !error && list.length === 0 && <Empty>Nenhum produto encontrado.</Empty>}

      {!loading && !error && list.length > 0 && (
        <ul className="divide-y divide-border">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.category?.name ?? 'Sem categoria'} · {p.sku}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{formatCurrency(num(p.salePrice))}</p>
                <p className={`text-xs ${p.stockQuantity <= 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {p.stockQuantity} em estoque
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
