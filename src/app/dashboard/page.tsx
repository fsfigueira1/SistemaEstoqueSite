'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
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
} from 'lucide-react';

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
  COMPLETED: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-800' },
  PENDING: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-600' },
  REFUNDED: { label: 'Estornada', cls: 'bg-red-100 text-red-700' },
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
        else setError(data?.error || 'Falha ao carregar indicadores');
      } catch {
        setError('Erro de rede ao carregar indicadores');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
          <p className="text-sm text-gray-500">Visão geral da loja</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Carregando…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : stats ? (
          <>
            {/* linha 1 — vendas */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={<DollarSign />} label="Faturamento hoje" value={brl(stats.todayRevenue)} accent />
              <Kpi icon={<ShoppingCart />} label="Vendas hoje" value={String(stats.todaySalesCount)} />
              <Kpi icon={<Receipt />} label="Ticket médio hoje" value={brl(stats.todayAvgTicket)} />
              <Kpi
                icon={<TrendingUp />}
                label="Faturamento do mês"
                value={brl(stats.monthRevenue)}
                sub={`${stats.monthSalesCount} venda(s)`}
              />
            </div>

            {/* linha 2 — estoque */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={<Package />} label="Produtos ativos" value={String(stats.activeProducts)} sub={`${stats.totalProducts} no total`} />
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
              <Kpi icon={<Boxes />} label="Valor em estoque" value={brl(stats.stockValue)} sub="a preço de custo" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* vendas recentes */}
              <div className="rounded-xl border border-gray-200 bg-white lg:col-span-2">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <h2 className="font-semibold text-gray-900">Vendas recentes</h2>
                  <Link href="/vendas" className="flex items-center gap-1 text-sm text-emerald-700 hover:underline">
                    Ver todas <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {stats.recentSales.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-500">Nenhuma venda ainda.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {stats.recentSales.map((s) => {
                      const st = STATUS_PT[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' };
                      return (
                        <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-900">#{s.numero}</span>
                            <span className="ml-2 text-gray-500">
                              {s.itens} item(s) · {s.cliente}
                            </span>
                            <span className="ml-2 text-xs text-gray-400">
                              {new Date(s.data).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                            <span className="font-semibold text-gray-900">{brl(s.total)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* alerta de estoque */}
              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <h2 className="font-semibold text-gray-900">Repor estoque</h2>
                  <Link href="/estoque" className="flex items-center gap-1 text-sm text-emerald-700 hover:underline">
                    Estoque <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {stats.lowStockList.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-500">Nada para repor. 👍</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {stats.lowStockList.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="truncate pr-2 text-gray-800">{p.nome}</span>
                        <span
                          className={`shrink-0 font-semibold ${
                            p.estoque === 0 ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {p.estoque}
                          <span className="text-xs font-normal text-gray-400"> / {p.minimo}</span>
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
              <QuickLink href="/vendas" label="Vendas" desc="Histórico e relatórios" icon={<Receipt />} />
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
  const valueCls = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${valueCls}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
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
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
    >
      <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span>
        <span className="block font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{desc}</span>
      </span>
    </Link>
  );
}
