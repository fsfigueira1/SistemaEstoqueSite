'use client';

// Relatórios — lista dos últimos dias com o que entrou por forma de pagamento
// e se o caixa foi conferido. Cada dia abre a sua página (/relatorios/AAAA-MM-DD).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, CircleDashed, Banknote, CreditCard, QrCode } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import type { HistoryDay } from '@/services/closingService';
import { differenceLabel } from '@/lib/closing';
import { errorText } from '@/lib/friendlyError';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function keyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function label(k: string) {
  const [y, m, d] = k.split('-').map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return s.replace('.', '');
}

export default function RelatoriosPage() {
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const today = keyOf(new Date());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/history?days=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(errorText(data, 'Relatórios indisponíveis'));
        setDays(data.data);
        setErr(null);
      })
      .catch((e) => setErr(errorText(e, 'Relatórios indisponíveis')))
      .finally(() => setLoading(false));
  }, [range]);

  const totals = useMemo(() => {
    const t = { revenue: 0, cash: 0, card: 0, pix: 0, sales: 0, pending: 0 };
    for (const d of days) {
      t.revenue += d.revenue;
      t.cash += d.net.cash;
      t.card += d.net.card;
      t.pix += d.net.pix;
      t.sales += d.salesCount;
      if (d.salesCount > 0 && !d.closing && d.date !== today) t.pending += 1;
    }
    return t;
  }, [days, today]);

  const net = totals.cash + totals.card + totals.pix;
  const share = (v: number) => (net > 0 ? Math.round((v / net) * 100) : 0);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow="Gestão"
          title="Relatórios"
          subtitle="O que entrou em cada dia e se o caixa bateu"
          actions={
            <>
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                aria-label="Período"
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
              <Link
                href={`/relatorios/${today}`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Relatório de hoje <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          }
        />

        {loading ? (
          <div className="py-24 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Carregando…
          </div>
        ) : err ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">{err}</div>
        ) : (
          <>
            {/* resumo do período */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-primary/25 bg-accent-soft/60 p-5">
                <p className="eyebrow !text-accent-soft-foreground">Faturamento</p>
                <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-foreground">{brl(totals.revenue)}</p>
                <p className="text-xs text-muted-foreground">{totals.sales} vendas no período</p>
              </div>
              <Share icon={<Banknote className="h-4 w-4" />} label="Dinheiro" value={totals.cash} pct={share(totals.cash)} />
              <Share icon={<CreditCard className="h-4 w-4" />} label="Cartão" value={totals.card} pct={share(totals.card)} />
              <Share icon={<QrCode className="h-4 w-4" />} label="Pix" value={totals.pix} pct={share(totals.pix)} />
            </section>

            {totals.pending > 0 && (
              <p className="flex items-center gap-2 rounded-xl border border-bow/25 bg-bow-soft/60 px-4 py-3 text-sm text-foreground">
                <AlertTriangle className="h-4 w-4 text-bow" />
                {totals.pending} {totals.pending === 1 ? 'dia com venda ainda não teve' : 'dias com venda ainda não tiveram'} o
                caixa conferido.
              </p>
            )}

            {/* dias */}
            <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              {days.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <img src="/logo.png" alt="" className="mx-auto h-14 w-14 rounded-2xl bg-white object-cover ring-1 ring-black/5" />
                  <p className="mt-3 font-heading text-lg text-foreground">Nenhuma venda no período</p>
                  <p className="text-sm text-muted-foreground">Os dias aparecem aqui assim que houver vendas.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-semibold">Dia</th>
                      <th className="px-4 py-3 text-right font-semibold">Vendas</th>
                      <th className="px-4 py-3 text-right font-semibold">Dinheiro</th>
                      <th className="px-4 py-3 text-right font-semibold">Cartão</th>
                      <th className="px-4 py-3 text-right font-semibold">Pix</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Caixa</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {days.map((d) => {
                      const total = d.net.cash + d.net.card + d.net.pix;
                      const status = d.closing?.counted ? differenceLabel(d.closing.difference, brl) : null;
                      return (
                        <tr key={d.date} className="group hover:bg-muted/50">
                          <td className="px-5 py-3">
                            <Link href={`/relatorios/${d.date}`} className="font-medium capitalize text-foreground group-hover:text-primary">
                              {d.date === today ? 'Hoje' : label(d.date)}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{d.salesCount}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{brl(d.net.cash)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{brl(d.net.card)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{brl(d.net.pix)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{brl(total)}</td>
                          <td className="px-4 py-3">
                            {status ? (
                              <span className={`pill ${status.tone === 'ok' ? 'pill-ok' : status.tone === 'short' ? 'pill-danger' : 'pill-warn'}`}>
                                {status.tone === 'ok' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {status.text}
                              </span>
                            ) : d.salesCount > 0 ? (
                              <span className="pill pill-muted">
                                <CircleDashed className="h-3 w-3" /> Não conferido
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link href={`/relatorios/${d.date}`} aria-label="Abrir dia" className="text-muted-foreground group-hover:text-primary">
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function Share({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: number; pct: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-primary">{icon}</span>
          <span className="eyebrow">{label}</span>
        </span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold tabular-nums text-foreground">{brl(value)}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
