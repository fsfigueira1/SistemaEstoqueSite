'use client';

// Sugestão de compra — olha o que vendeu nos últimos dias e monta a lista do
// que repor, separada por fornecedor, pronta para mandar pelo WhatsApp.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, Info, Loader2, PackageOpen, RotateCcw } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import SupplierOrderCard from '@/components/compras/SupplierOrderCard';
import type { RestockPlan } from '@/lib/restock';
import { errorText } from '@/lib/friendlyError';
import { loadSettings } from '@/lib/settings';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function ComprasPage() {
  const [days, setDays] = useState(30);
  const [cover, setCover] = useState(30);
  const [plan, setPlan] = useState<RestockPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [store, setStore] = useState('loja');

  useEffect(() => {
    loadSettings()
      .then((s) => setStore(s.companyName || 'loja'))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/restock?days=${days}&cover=${cover}`);
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Sugestão indisponível'));
      setPlan(data.data);
      setErr(null);
    } catch (e) {
      setErr(errorText(e, 'Sugestão indisponível'));
    } finally {
      setLoading(false);
    }
  }, [days, cover]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (productId: string, supplierId: string) => {
    const r = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.success) {
      window.alert(errorText(data, 'Não foi possível salvar'));
      return;
    }
    load();
  };

  const edited = Object.keys(qty).length > 0;
  const all = plan?.groups.flatMap((g) => g.items) ?? [];
  const units = all.reduce((n, i) => n + (qty[i.productId] ?? i.suggested), 0);
  const cost = all.reduce((n, i) => n + (qty[i.productId] ?? i.suggested) * i.cost, 0);
  const urgent = all.filter((i) => i.urgency === 'out' || i.urgency === 'soon').length;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow="Gestão"
          title="Sugestão de compra"
          subtitle="O que repor, com base no que vendeu — separado por fornecedor"
          actions={
            <>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Vendas dos últimos
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
                >
                  {[15, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} dias
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Comprar para
                <select
                  value={cover}
                  onChange={(e) => setCover(Number(e.target.value))}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
                >
                  {[15, 30, 45, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} dias
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
        />

        {loading && !plan ? (
          <div className="py-24 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Somando as vendas…
          </div>
        ) : err ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">{err}</div>
        ) : plan && plan.groups.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 font-heading text-xl text-foreground">Nada para repor agora</p>
            <p className="text-sm text-muted-foreground">
              O estoque dá conta do ritmo de vendas dos últimos {days} dias.
            </p>
          </div>
        ) : plan ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-primary/25 bg-accent-soft/60 p-5">
                <p className="eyebrow !text-accent-soft-foreground">Custo estimado</p>
                <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-foreground">{brl(cost)}</p>
                <p className="text-xs text-muted-foreground">pelo preço de custo cadastrado</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="eyebrow">Produtos</p>
                <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-foreground">{all.length}</p>
                <p className="text-xs text-muted-foreground">
                  {units} unidades · {plan.groups.length} {plan.groups.length === 1 ? 'fornecedor' : 'fornecedores'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="eyebrow">Urgentes</p>
                <p className={`mt-2 font-heading text-3xl font-semibold tabular-nums ${urgent ? 'text-danger' : 'text-foreground'}`}>
                  {urgent}
                </p>
                <p className="text-xs text-muted-foreground">zerados ou acabam em até 7 dias</p>
              </div>
            </section>

            <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Conta: o que vendeu por dia × {cover} dias + o estoque mínimo, menos o que tem. Ajuste as quantidades à vontade
                antes de mandar. Para mudar o mínimo de um produto, edite em{' '}
                <Link href="/produtos" className="text-primary hover:underline">
                  Produtos
                </Link>
                .
              </span>
              {edited && (
                <button
                  type="button"
                  onClick={() => setQty({})}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Voltar às sugestões
                </button>
              )}
            </p>

            <div className="space-y-5">
              {plan.groups.map((g) => (
                <SupplierOrderCard
                  key={g.supplier?.id ?? 'none'}
                  group={g}
                  days={days}
                  storeName={store}
                  qty={qty}
                  onQty={(id, v) => setQty((q) => ({ ...q, [id]: v }))}
                  onAssign={assign}
                />
              ))}
            </div>
          </>
        ) : null}

        {!loading && plan && plan.groups.length > 0 && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
            Quando a mercadoria chegar, dê entrada em{' '}
            <Link href="/estoque" className="text-primary hover:underline">
              Estoque
            </Link>
            <PackageOpen className="h-3.5 w-3.5" />
          </p>
        )}
      </div>
    </Layout>
  );
}
