'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout, { PageHeader } from '@/components/Layout';
import {
  DollarSign,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Package,
  AlertTriangle,
  XCircle,
  Boxes,
  ArrowRight,
  Loader2,
  NotebookPen,
} from 'lucide-react';
import { errorText } from '@/lib/friendlyError';

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
  recentSales: Array<{
    id: string;
    numero: string;
    status: string;
    total: number;
    itens: number;
    cliente: string;
    data: string;
  }>;
  lowStockList: Array<{ id: string; nome: string; estoque: number; minimo: number }>;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const STATUS_PT: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: 'Concluída', cls: 'pill-ok' },
  PENDING: { label: 'Pendente', cls: 'pill-warn' },
  CANCELLED: { label: 'Cancelada', cls: 'pill-muted' },
  REFUNDED: { label: 'Estornada', cls: 'pill-danger' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (data.success) setStats(data.data);
        else setError(errorText(data, 'Falha ao carregar indicadores'));
      } catch {
        setError('Sem conexão');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <PageHeader
          eyebrow={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          title="Painel"
          actions={
            <Link
              href="/relatorios"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40"
            >
              <NotebookPen className="h-4 w-4 text-primary" /> Relatório do dia
            </Link>
          }
        />

        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Carregando…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>
        ) : stats ? (
          <>
            {/* faixa do dia */}
            <div className="overflow-hidden rounded-2xl border-2 border-primary/25 bg-accent-soft/50 shadow-sm">
              <div className="grid divide-y divide-primary/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-soft-foreground">
                    <DollarSign className="h-4 w-4" />
                    Faturamento hoje
                  </div>
                  <div className="mt-1 font-heading text-3xl font-bold tabular-nums text-primary">
                    {brl(stats.todayRevenue)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ShoppingCart className="h-4 w-4" />
                    Vendas hoje
                  </div>
                  <div className="mt-1 font-heading text-3xl font-bold tabular-nums text-foreground">
                    {stats.todaySalesCount}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                    Ticket médio
                  </div>
                  <div className="mt-1 font-heading text-3xl font-bold tabular-nums text-foreground">
                    {brl(stats.todayAvgTicket)}
                  </div>
                </div>
              </div>
            </div>

            {/* estoque + mês */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi
                icon={<TrendingUp />}
                label="Faturamento do mês"
                value={brl(stats.monthRevenue)}
                sub={`${stats.monthSalesCount} venda(s)`}
              />
              <Kpi
                icon={<Package />}
                label="Produtos ativos"
                value={String(stats.activeProducts)}
                sub={`${stats.totalProducts} no total`}
              />
              <Kpi
                icon={<AlertTriangle />}
                label="Estoque baixo"
                value={String(stats.lowStockCount)}
                tone={stats.lowStockCount ? 'warn' : undefined}
              />
              <Kpi
                icon={<XCircle />}
                label="Sem estoque"
                value={String(stats.outOfStockCount)}
                tone={stats.outOfStockCount ? 'danger' : undefined}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* vendas recentes */}
              <div className="rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h2 className="text-lg text-foreground">Vendas recentes</h2>
                  <Link href="/vendas" className="flex items-center gap-1 text-sm text-primary hover:underline">
                    Ver todas <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {stats.recentSales.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma venda ainda.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.recentSales.map((s) => {
                      const st = STATUS_PT[s.status] ?? { label: s.status, cls: 'pill-muted' };
                      return (
                        <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                          <div>
                            <span className="font-medium text-foreground">#{s.numero}</span>
                            <span className="ml-2 text-muted-foreground">
                              {s.itens} item(s) · {s.cliente}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {new Date(s.data).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                            <span className="font-semibold text-foreground">{brl(s.total)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* alerta de estoque */}
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h2 className="text-lg text-foreground">Repor estoque</h2>
                  <Link href="/compras" className="flex items-center gap-1 text-sm text-primary hover:underline">
                    Sugestão de compra <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {stats.lowStockList.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nada para repor.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.lowStockList.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="truncate pr-2 text-foreground">{p.nome}</span>
                        <span
                          className={`shrink-0 font-semibold ${
                            p.estoque === 0 ? 'text-danger' : 'text-amber-600'
                          }`}
                        >
                          {p.estoque}
                          <span className="text-xs font-normal text-muted-foreground"> / {p.minimo}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* atalhos */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <QuickLink href="/pdv" label="Abrir PDV" desc="Registrar uma venda" icon={<ShoppingCart />} />
              <QuickLink href="/produtos" label="Produtos" desc="Cadastrar / editar catálogo" icon={<Package />} />
              <QuickLink href="/relatorios" label="Relatórios" desc="Conferir o caixa do dia" icon={<NotebookPen />} />
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  tone?: 'warn' | 'danger';
}) {
  const valueCls = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-amber-600' : 'text-foreground';
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-primary/30 bg-accent-soft' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${valueCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function QuickLink({
  href,
  label,
  desc,
  icon,
}: {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-card shadow-sm p-4 transition-colors hover:border-primary/40 hover:bg-accent-soft"
    >
      <span className="rounded-lg bg-accent-soft p-2 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </Link>
  );
}
