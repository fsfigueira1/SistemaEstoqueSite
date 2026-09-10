'use client';

import { formatCurrency } from '@/lib/format';
import { useApi } from '@/components/mobile/useApi';
import { PageTitle, Loading, ErrorMsg, Empty } from '@/components/mobile/Shared';

type Sale = {
  id: string;
  saleNumber: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
  customer?: { name?: string } | null;
  _count?: { items?: number };
};

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0);

const statusLabel: Record<string, string> = {
  COMPLETED: 'Concluída',
  PENDING: 'Pendente',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Estornada',
};

export default function MobileVendas() {
  const { data, loading, error } = useApi<{ sales: Sale[] }>('/api/sales?limit=40&page=1');

  if (loading) return <><PageTitle>Vendas</PageTitle><Loading /></>;
  if (error) return <><PageTitle>Vendas</PageTitle><ErrorMsg>{error}</ErrorMsg></>;

  const sales = data?.sales ?? [];
  if (sales.length === 0) return <><PageTitle>Vendas</PageTitle><Empty>Nenhuma venda ainda.</Empty></>;

  return (
    <>
      <PageTitle>Vendas recentes</PageTitle>
      <ul className="divide-y divide-border">
        {sales.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {s.customer?.name || 'Consumidor'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {s._count?.items ?? 0} item(ns) · {statusLabel[s.status] ?? s.status}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {formatCurrency(num(s.totalAmount))}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
