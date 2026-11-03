'use client';

// Relatório do mês (/relatorios/mes/AAAA-MM): faturamento com comparação ao
// mês anterior, dia a dia, formas de pagamento, mais vendidos e os ajustes de
// estoque — cada saída com o motivo e a explicação de quem tirou, e o custo do
// que saiu sem ser vendido. Dá para imprimir.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, PackageMinus, PackagePlus, Printer } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import { ColumnChart, RankBars, ShareBar, StatTile, brl } from '@/components/charts/Charts';
import { errorText } from '@/lib/friendlyError';
import type { MonthlyReport } from '@/services/monthlyReportService';

type Report = Omit<MonthlyReport, 'adjustments'> & { adjustments: Array<MonthlyReport['adjustments'][number] & { at: string }> };

const shift = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const dayMonth = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Panel({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 shadow-sm print:break-inside-avoid print:shadow-none ${className}`}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Adjustments({ r }: { r: Report }) {
  const s = r.adjustmentSummary;
  return (
    <Panel title="Ajustes de estoque" sub="Tudo que entrou ou saiu do estoque sem ser compra ou venda — com o motivo e a explicação de quem lançou">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-danger/10 p-3">
              <p className="text-xs text-muted-foreground">Saiu sem vender</p>
              <p className="font-heading text-xl font-semibold tabular-nums text-foreground">{s.outUnits} un.</p>
              <p className="text-xs text-muted-foreground">custo {brl(s.outCost)}</p>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">Entradas manuais</p>
              <p className="font-heading text-xl font-semibold tabular-nums text-foreground">{s.inUnits} un.</p>
            </div>
          </div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Custo por motivo</p>
          <RankBars tone="danger" items={s.byReason.map((b) => ({ label: b.reason, value: b.cost, extra: `${b.quantity} un.` }))} empty="Nenhuma saída manual no mês." />
        </div>
        <div className="overflow-x-auto">
          {r.adjustments.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Quando</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 text-right font-medium">Qtd</th>
                  <th className="py-2 pr-3 font-medium">Motivo e explicação</th>
                  <th className="py-2 text-right font-medium">Custo</th>
                </tr>
              </thead>
              <tbody>
                {r.adjustments.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-muted-foreground">{dayMonth(a.at)}</td>
                    <td className="py-2 pr-3 text-foreground">{a.product}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">
                      <span className={`inline-flex items-center gap-1 ${a.direction === 'saida' ? 'text-danger' : 'text-success'}`}>
                        {a.direction === 'saida' ? <PackageMinus className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
                        {a.direction === 'saida' ? '−' : '+'}
                        {a.quantity}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-foreground">{a.reason}</span>
                      <span className="block text-xs text-muted-foreground">{a.explanation}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 text-right tabular-nums text-muted-foreground">{a.direction === 'saida' ? brl(a.cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ajuste de estoque neste mês.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function RelatorioMesPage() {
  const { mes } = useParams<{ mes: string }>();
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setR(null);
    setErr(null);
    fetch(`/api/reports/monthly?month=${encodeURIComponent(mes)}`)
      .then((res) => res.json())
      .then((d) => (d.success ? setR(d.data) : setErr(errorText(d, 'Relatório indisponível'))))
      .catch(() => setErr('Sem conexão'));
  }, [mes]);

  const delta = r && r.sales.previousRevenue > 0 ? ((r.sales.revenue - r.sales.previousRevenue) / r.sales.previousRevenue) * 100 : null;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-5 p-6 print:p-0">
        <PageHeader eyebrow="Relatórios" title={`Relatório de ${monthName(mes)}`} subtitle="Vendas, pagamentos, mais vendidos e o que saiu do estoque sem ser vendido" />
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link href={`/relatorios/mes/${shift(mes, -1)}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            <ChevronLeft className="h-4 w-4" /> {monthName(shift(mes, -1))}
          </Link>
          <Link href={`/relatorios/mes/${shift(mes, 1)}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            {monthName(shift(mes, 1))} <ChevronRight className="h-4 w-4" />
          </Link>
          <button type="button" onClick={() => window.print()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
        {!r && !err && (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {r && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Faturamento" value={brl(r.sales.revenue)} delta={delta} sub={r.sales.ongoing ? 'vs mesmo trecho do mês anterior' : 'vs mês anterior'} />
              <StatTile label="Vendas" value={String(r.sales.count)} sub={r.sales.discount > 0 ? `${brl(r.sales.discount)} em descontos` : undefined} />
              <StatTile label="Ticket médio" value={brl(r.sales.avgTicket)} />
              <StatTile label="Saiu sem vender" value={brl(r.adjustmentSummary.outCost)} sub={`${r.adjustmentSummary.outUnits} un. a preço de custo`} />
            </div>

            <Panel title="Faturamento por dia">
              <ColumnChart data={r.days.map((d) => ({ label: d.date.slice(8), value: d.revenue, hint: `${d.date.slice(8)}/${d.date.slice(5, 7)} · ${d.count} venda(s)` }))} />
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Formas de pagamento">
                <ShareBar
                  parts={[
                    { label: 'Dinheiro', value: r.methods.cash, color: 'var(--chart-1)' },
                    { label: 'Cartão', value: r.methods.card, color: 'var(--chart-2)' },
                    { label: 'Pix', value: r.methods.pix, color: 'var(--chart-3)' },
                  ]}
                />
              </Panel>
              <Panel title="Mais vendidos" sub="por faturamento no mês">
                <RankBars items={r.topProducts.map((p) => ({ label: p.name, value: p.revenue, extra: `${p.quantity} un.` }))} empty="Nenhuma venda no mês." />
              </Panel>
            </div>

            <Adjustments r={r} />
          </>
        )}
      </div>
    </Layout>
  );
}
