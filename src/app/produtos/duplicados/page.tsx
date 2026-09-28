'use client';

// Produtos → Duplicados: mostra produtos cadastrados mais de uma vez e deixa
// juntar num só (vendas, estoque e histórico passam para o escolhido).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Copy, Loader2, Merge } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import type { DupView } from '@/services/duplicateService';
import { errorText } from '@/lib/friendlyError';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function Group({ g, onMerged }: { g: DupView; onMerged: (msg: string) => void }) {
  // sugere manter o que tem código de barras e mais vendas
  const best = [...g.items].sort((a, b) => Number(!!b.barcode) - Number(!!a.barcode) || b.sales - a.sales)[0];
  const [keep, setKeep] = useState(best?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const merge = async () => {
    const others = g.items.filter((i) => i.id !== keep);
    const k = g.items.find((i) => i.id === keep);
    if (!k || !window.confirm(`Juntar ${others.length} produto(s) em "${k.name}"? O estoque soma e as vendas passam para ele.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/products/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId: keep, removeIds: others.map((o) => o.id) }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não foi possível juntar'));
      onMerged(`"${k.name}" agora tem ${data.data.stock} em estoque.`);
    } catch (e) {
      setErr(errorText(e, 'Não foi possível juntar'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="pill pill-warn">
          <Copy className="h-3 w-3" /> {g.reason}
        </span>
        <div className="flex items-center gap-3">
          {err && <span className="text-sm text-danger">{err}</span>}
          <button
            type="button"
            onClick={merge}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
            Juntar no marcado
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-2 font-semibold">Fica</th>
            <th className="px-2 py-2 font-semibold">Produto</th>
            <th className="px-2 py-2 text-right font-semibold">Preço</th>
            <th className="px-2 py-2 text-right font-semibold">Estoque</th>
            <th className="px-2 py-2 text-right font-semibold">Vendas</th>
            <th className="px-5 py-2 text-right font-semibold">Cadastrado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {g.items.map((i) => (
            <tr key={i.id} className={i.id === keep ? 'bg-accent-soft/40' : ''}>
              <td className="px-5 py-2.5">
                <input type="radio" checked={i.id === keep} onChange={() => setKeep(i.id)} aria-label={`Manter ${i.name}`} />
              </td>
              <td className="px-2 py-2.5">
                <div className="font-medium text-foreground">{i.name}</div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {i.barcode ?? 'sem código de barras'} · SKU {i.sku}
                  {i.status !== 'ACTIVE' && ' · inativo'}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{brl(i.salePrice)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{i.stock}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{i.sales}</td>
              <td className="px-5 py-2.5 text-right text-xs text-muted-foreground">
                {new Date(i.createdAt).toLocaleDateString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function DuplicadosPage() {
  const [groups, setGroups] = useState<DupView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/products/duplicates');
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não foi possível verificar'));
      setGroups(data.data);
      setErr(null);
    } catch (e) {
      setErr(errorText(e, 'Não foi possível verificar'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <PageHeader
          eyebrow="Produtos"
          title="Produtos duplicados"
          subtitle="Mesmo nome ou mesmo código cadastrado mais de uma vez"
          actions={
            <Link href="/produtos" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Produtos
            </Link>
          }
        />
        {msg && <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{msg}</div>}
        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
        {!groups && !err ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Procurando…
          </div>
        ) : groups && groups.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 font-heading text-xl text-foreground">Nenhum produto duplicado</p>
          </div>
        ) : (
          <>
            {groups && (
              <p className="text-sm text-muted-foreground">
                {groups.length} grupo(s). Marque o que fica: o estoque dos outros soma nele e as vendas passam para ele.
              </p>
            )}
            {groups?.map((g) => (
              <Group
                key={g.items.map((i) => i.id).join()}
                g={g}
                onMerged={(m) => {
                  setMsg(m);
                  load();
                }}
              />
            ))}
          </>
        )}
      </div>
    </Layout>
  );
}
