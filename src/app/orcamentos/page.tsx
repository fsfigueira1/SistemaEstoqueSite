'use client';

// Orçamentos pedidos: o que os clientes pediram pelo WhatsApp (copiloto) ou no
// balcão (Lista Escolar). Quando a pessoa chega, busque pelo nome ou telefone
// e leve os itens para o PDV com o preço de agora.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, ShoppingCart, X } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import { errorText } from '@/lib/friendlyError';
import { sendToPdv, type PrefillItem } from '@/lib/pdvPrefill';

type Summary = { id: string; name: string; phone: string | null; title: string; total: number; status: string; source: string; createdAt: string; itemCount: number };
type Detail = Summary & {
  items: Array<{ qty: number; text: string; productId: string | null; price: number | null; take: number; now: { price: number; stock: number; active: boolean; name: string; code: string } | null }>;
  toConfirm: string[];
  message: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'pill pill-warn' },
  separado: { label: 'Separado', cls: 'pill pill-ok' },
  retirado: { label: 'Retirado', cls: 'pill pill-muted' },
  cancelado: { label: 'Cancelado', cls: 'pill pill-muted' },
};
const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtPhone = (p: string | null) => (p ? p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : '');
const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

async function api(url: string, method = 'GET', body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui carregar'));
  return data.data;
}

export default function OrcamentosPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [list, setList] = useState<Summary[] | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (status) p.set('status', status);
      setList(await api(`/api/quote-requests?${p}`));
    } catch (e) {
      setErr(errorText(e, 'Não consegui carregar'));
      setList([]);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openQuote = useCallback(async (id: string) => {
    setErr(null);
    try {
      setOpen(await api(`/api/quote-requests/${id}`));
    } catch (e) {
      setErr(errorText(e, 'Não consegui abrir o orçamento'));
    }
  }, []);

  // vindo do Atendimento: /orcamentos?id=…
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) openQuote(id);
  }, [openQuote]);

  const setQuoteStatus = async (s: string) => {
    if (!open) return;
    try {
      await api(`/api/quote-requests/${open.id}`, 'PATCH', { status: s });
      setOpen({ ...open, status: s });
      load();
    } catch (e) {
      setErr(errorText(e, 'Não consegui mudar a situação'));
    }
  };

  const toPdv = async () => {
    if (!open) return;
    // só o que está ativo e tem estoque agora, com o preço de agora
    const items: PrefillItem[] = open.items.flatMap((i) =>
      i.productId && i.now?.active && i.now.stock > 0
        ? [{ id: i.productId, name: i.now.name, code: i.now.code, price: i.now.price, stock: i.now.stock, qty: Math.min(i.qty, i.now.stock) }]
        : [],
    );
    if (!items.length) {
      setErr('Nenhum item do orçamento está com estoque agora');
      return;
    }
    sendToPdv(items);
    if (window.confirm('Itens enviados para o PDV. Marcar este orçamento como retirado?')) {
      try {
        await api(`/api/quote-requests/${open.id}`, 'PATCH', { status: 'retirado' });
      } catch {
        /* a venda é o que importa; a situação dá para mudar depois */
      }
    }
    router.push('/pdv');
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader eyebrow="Balcão" title="Orçamentos pedidos" subtitle="O que os clientes pediram — ache pelo nome ou telefone e leve para o PDV" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou telefone" className="w-64 rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="">Todas as situações</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">{err}</div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {list === null ? (
              <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </p>
            ) : list.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nenhum orçamento {q || status ? 'encontrado' : 'ainda — eles aparecem aqui quando o Atendimento monta um'}.</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => openQuote(o.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 ${open?.id === o.id ? 'bg-accent-soft/50' : ''}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{o.name || 'Sem nome'}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {fmtPhone(o.phone) || (o.source === 'balcao' ? 'Balcão' : 'Sem telefone')} · {fmtDate(o.createdAt)} · {o.itemCount} itens
                        </span>
                      </span>
                      <span className="tabular-nums text-foreground">{brl(o.total)}</span>
                      <span className={STATUS[o.status]?.cls ?? 'pill pill-muted'}>{STATUS[o.status]?.label ?? o.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {open && (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg text-foreground">{open.name || 'Sem nome'}</h2>
                  <p className="text-xs text-muted-foreground">
                    {fmtPhone(open.phone)} {open.phone && '·'} {fmtDate(open.createdAt)} · {open.title}
                  </p>
                </div>
                <button onClick={() => setOpen(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 font-semibold">Qtd.</th>
                    <th className="py-2 font-semibold">Item</th>
                    <th className="py-2 text-right font-semibold">No orçamento</th>
                    <th className="py-2 text-right font-semibold">Agora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {open.items.map((i, k) => (
                    <tr key={k}>
                      <td className="py-1.5 tabular-nums">{i.qty}</td>
                      <td className="py-1.5">{i.now?.name ?? i.text}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{i.price != null ? brl(i.price) : '—'}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {!i.now ? (
                          <span className="text-danger">removido</span>
                        ) : !i.now.active ? (
                          <span className="text-danger">inativo</span>
                        ) : (
                          <>
                            <span className={i.price != null && i.now.price !== i.price ? 'font-semibold text-foreground' : ''}>{brl(i.now.price)}</span>
                            <span className={`block text-[11px] ${i.now.stock < i.qty ? 'text-danger' : 'text-muted-foreground'}`}>{i.now.stock} em estoque</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right text-sm">
                Total no orçamento: <strong className="tabular-nums">{brl(open.total)}</strong>
              </p>

              {open.toConfirm.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <p className="mb-1 font-medium text-foreground">A loja confirma</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {open.toConfirm.map((t, k) => (
                      <li key={k}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {open.message && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Mensagem enviada ao cliente</summary>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs">{open.message}</p>
                </details>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(STATUS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setQuoteStatus(k)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${open.status === k ? 'border-primary bg-accent-soft/60 text-foreground' : 'border-border hover:bg-muted'}`}
                  >
                    {v.label}
                  </button>
                ))}
                <button type="button" onClick={toPdv} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <ShoppingCart className="h-4 w-4" /> Levar para o PDV
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
