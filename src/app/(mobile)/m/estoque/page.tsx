'use client';

import { useMemo } from 'react';
import { useApi } from '@/components/mobile/useApi';
import { PageTitle, Loading, ErrorMsg, Empty } from '@/components/mobile/Shared';

type Product = {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  minStockLevel: number;
  status: string;
};

export default function MobileEstoque() {
  const { data, loading, error } = useApi<{ products: Product[] }>('/api/products?limit=500');

  const { out, low } = useMemo(() => {
    const items = (data?.products ?? []).filter((p) => p.status === 'ACTIVE');
    return {
      out: items.filter((p) => p.stockQuantity <= 0),
      low: items
        .filter((p) => p.stockQuantity > 0 && p.stockQuantity <= (p.minStockLevel || 5))
        .sort((a, b) => a.stockQuantity - b.stockQuantity),
    };
  }, [data]);

  if (loading) return <><PageTitle>Estoque</PageTitle><Loading /></>;
  if (error) return <><PageTitle>Estoque</PageTitle><ErrorMsg>{error}</ErrorMsg></>;

  const Section = ({ title, items, tone }: { title: string; items: Product[]; tone: string }) => (
    <section className="space-y-2 p-4">
      <h2 className="font-heading text-base font-bold text-foreground">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <Empty>Nada por aqui.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.sku}</p>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${tone}`}>
                {p.stockQuantity} / mín {p.minStockLevel || 5}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <PageTitle>Estoque</PageTitle>
      <Section title="Esgotados" items={out} tone="text-red-600" />
      <Section title="Estoque baixo" items={low} tone="text-amber-600" />
    </>
  );
}
