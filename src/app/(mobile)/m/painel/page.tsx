'use client';

import { formatCurrency } from '@/lib/format';
import { useApi } from '@/components/mobile/useApi';
import { PageTitle, Loading, ErrorMsg } from '@/components/mobile/Shared';

type Stats = {
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
  todayRevenue: number;
  todaySalesCount: number;
  todayAvgTicket: number;
  monthRevenue: number;
  monthSalesCount: number;
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function MobilePainel() {
  const { data, loading, error } = useApi<Stats>('/api/dashboard/stats');

  if (loading) return <><PageTitle>Painel</PageTitle><Loading /></>;
  if (error || !data) return <><PageTitle>Painel</PageTitle><ErrorMsg>{error ?? 'Sem dados'}</ErrorMsg></>;

  return (
    <>
      <PageTitle>Painel</PageTitle>
      <div className="grid grid-cols-2 gap-3 p-4">
        <Card label="Vendas hoje" value={formatCurrency(data.todayRevenue)} hint={`${data.todaySalesCount} venda(s)`} />
        <Card label="Ticket médio hoje" value={formatCurrency(data.todayAvgTicket)} />
        <Card label="Vendas no mês" value={formatCurrency(data.monthRevenue)} hint={`${data.monthSalesCount} venda(s)`} />
        <Card label="Valor em estoque" value={formatCurrency(data.stockValue)} />
        <Card label="Produtos ativos" value={String(data.activeProducts)} hint={`${data.totalProducts} no total`} />
        <Card
          label="Alertas de estoque"
          value={String(data.lowStockCount + data.outOfStockCount)}
          hint={`${data.outOfStockCount} esgotado(s)`}
        />
      </div>
    </>
  );
}
