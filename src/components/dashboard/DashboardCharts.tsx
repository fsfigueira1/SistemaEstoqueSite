'use client';

// Gráficos do Painel: números do dia e do mês (com comparação), tendência dos
// últimos 35 dias, mapa de calor por dia da semana, horário de pico, formas
// de pagamento e mais vendidos do mês. Dados de /api/dashboard/charts;
// o Painel pede atualização a cada 30 s (refreshKey).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ColumnChart, HeatCalendar, RankBars, ShareBar, StatTile, TrendChart, brl } from '@/components/charts/Charts';

type Charts = {
  today: { revenue: number; count: number; avgTicket: number; lastWeek: number };
  month: {
    revenue: number;
    count: number;
    prevToDate: number;
    methods: { cash: number; card: number; pix: number };
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    lostCost: number;
  };
  days: Array<{ date: string; revenue: number; count: number }>;
  hours: Array<{ hour: number; revenue: number; count: number }>;
};

const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);
const dm = (k: string) => `${k.slice(8)}/${k.slice(5, 7)}`;

function Panel({ title, sub, action, children, className = '' }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DashboardCharts({ refreshKey = 0 }: { refreshKey?: number }) {
  const [c, setC] = useState<Charts | null>(null);
  const [failed, setFailed] = useState(false);

  // tempo real: atualiza junto com o painel (refreshKey) sem apagar o que já está na tela
  useEffect(() => {
    fetch('/api/dashboard/charts')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setC(d.data);
          setFailed(false);
        } else setFailed((was) => was || c === null);
      })
      .catch(() => setFailed((was) => was || c === null));
    // só recarrega quando o painel pede (refreshKey); c fica de fora de propósito
  }, [refreshKey]);

  if (failed) return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Os gráficos não carregaram agora. Recarregue a página.</p>;
  if (!c) return <div className="h-64 animate-pulse rounded-2xl bg-muted/60" aria-label="Carregando gráficos" />;

  const monthKey = c.days[c.days.length - 1]?.date.slice(0, 7) ?? '';
  const best = c.days.reduce((a, d) => (d.revenue > a.revenue ? d : a), c.days[0]);
  const peak = c.hours.reduce((a, h) => (h.revenue > a.revenue ? h : a), c.hours[0] ?? { hour: 0, revenue: 0, count: 0 });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Hoje" value={brl(c.today.revenue)} delta={pct(c.today.revenue, c.today.lastWeek)} sub={`${c.today.count} venda(s) · vs semana passada`} />
        <StatTile label="Ticket médio hoje" value={brl(c.today.avgTicket)} />
        <StatTile label="Mês até hoje" value={brl(c.month.revenue)} delta={pct(c.month.revenue, c.month.prevToDate)} sub="vs mesmo trecho do mês passado" />
        <StatTile label="Saiu sem vender no mês" value={brl(c.month.lostCost)} sub="perdas e ajustes, a custo" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Faturamento dos últimos 35 dias"
          sub={best && best.revenue > 0 ? `Melhor dia: ${dm(best.date)} com ${brl(best.revenue)}` : undefined}
          className="lg:col-span-2"
        >
          <TrendChart data={c.days.map((d) => ({ label: dm(d.date), value: d.revenue, hint: `${dm(d.date)} · ${d.count} venda(s)` }))} />
        </Panel>
        <Panel title="Dias que mais vendem" sub="cada quadrado é um dia; mais escuro, mais vendas">
          <HeatCalendar days={c.days} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Horário de pico" sub={peak && peak.revenue > 0 ? `Mais movimento às ${peak.hour}h (últimos 35 dias)` : 'últimos 35 dias'}>
          <ColumnChart height={190} data={c.hours.map((h) => ({ label: `${h.hour}h`, value: h.revenue, hint: `${h.hour}h às ${h.hour + 1}h · ${h.count} venda(s)` }))} />
        </Panel>
        <Panel title="Formas de pagamento" sub="no mês">
          <ShareBar
            parts={[
              { label: 'Dinheiro', value: c.month.methods.cash, color: 'var(--chart-1)' },
              { label: 'Cartão', value: c.month.methods.card, color: 'var(--chart-2)' },
              { label: 'Pix', value: c.month.methods.pix, color: 'var(--chart-3)' },
            ]}
          />
        </Panel>
        <Panel
          title="Mais vendidos do mês"
          action={
            monthKey && (
              <Link href={`/relatorios/mes/${monthKey}`} className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
                Relatório do mês <ArrowRight className="h-3 w-3" />
              </Link>
            )
          }
        >
          <RankBars items={c.month.topProducts.map((p) => ({ label: p.name, value: p.revenue, extra: `${p.quantity} un.` }))} empty="Nenhuma venda no mês ainda." />
        </Panel>
      </div>
    </div>
  );
}
