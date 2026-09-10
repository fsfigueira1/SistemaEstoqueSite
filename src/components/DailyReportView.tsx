'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { brtDayString } from '@/lib/brtDay';

type Report = {
  date: string;
  generatedAt: string;
  totalAmount: number | string;
  salesCount: number;
  averageTicket: number | string;
};

type Stats = {
  todayRevenue: number;
  todaySalesCount: number;
  todayAvgTicket: number;
};

function num(v: number | string): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function ymdLabel(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function Numbers({
  total,
  count,
  avg,
}: {
  total: number;
  count: number;
  avg: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total vendido</p>
        <p className="mt-1 font-heading text-lg font-bold text-foreground">{formatCurrency(total)}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas</p>
        <p className="mt-1 font-heading text-lg font-bold text-foreground">{count}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ticket médio</p>
        <p className="mt-1 font-heading text-lg font-bold text-foreground">{formatCurrency(avg)}</p>
      </div>
    </div>
  );
}

export default function DailyReportView() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = brtDayString(new Date());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/daily-reports?limit=90');
        if (!res.ok) throw new Error('Falha ao carregar relatórios');
        const json = await res.json();
        if (alive) setReports(json.data ?? []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Erro');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const todayReport = reports?.find((r) => String(r.date).slice(0, 10) === today) ?? null;

  useEffect(() => {
    if (reports === null || todayReport) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setStats(json.data ?? null);
      } catch {
        /* prévia é opcional */
      }
    })();
    return () => {
      alive = false;
    };
  }, [reports, todayReport]);

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error}</p>;
  }
  if (reports === null) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  }

  const past = reports.filter((r) => String(r.date).slice(0, 10) !== today);

  return (
    <div className="space-y-6 p-4">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-base font-bold text-foreground">Relatório de hoje</h2>
          <span className="text-xs text-muted-foreground">{ymdLabel(today)}</span>
        </div>

        {todayReport ? (
          <>
            <p className="text-xs text-muted-foreground">
              Gerado às 19:00 ·{' '}
              {new Date(todayReport.generatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <Numbers
              total={num(todayReport.totalAmount)}
              count={todayReport.salesCount}
              avg={num(todayReport.averageTicket)}
            />
          </>
        ) : (
          <>
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Ainda não gerado — sai às 19:00.
              {stats ? ' Prévia parcial do dia até agora:' : ''}
            </p>
            {stats && (
              <Numbers
                total={stats.todayRevenue}
                count={stats.todaySalesCount}
                avg={stats.todayAvgTicket}
              />
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-base font-bold text-foreground">Dias anteriores</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório anterior ainda.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {past.map((r) => (
              <li key={String(r.date)} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-foreground">{ymdLabel(String(r.date).slice(0, 10))}</span>
                <span className="flex items-center gap-3 text-right">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(num(r.totalAmount))}
                  </span>
                  <span className="w-14 text-xs text-muted-foreground">{r.salesCount} vd.</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
