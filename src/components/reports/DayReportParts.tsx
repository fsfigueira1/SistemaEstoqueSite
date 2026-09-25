'use client';

// Peças da página do relatório do dia (/relatorios/AAAA-MM-DD).

import Link from 'next/link';
import { AlertTriangle, ArrowRight, PackageSearch, Percent, TrendingUp } from 'lucide-react';
import type { DailyReport } from '@/services/reportService';

export const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/** Falas da assistente + avisos do dia. */
export function AssistantSummary({ report }: { report: DailyReport }) {
  return (
    <section className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <img
        src="/logo.png"
        alt=""
        className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-black/5"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="eyebrow !text-bow">Resumo da assistente</p>
        <ul className="space-y-1 text-sm text-foreground">
          {report.insights.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              {t}
            </li>
          ))}
        </ul>
        {report.alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {report.alerts.map((a, i) =>
              a.href ? (
                <Link key={i} href={a.href} className="pill pill-warn hover:underline">
                  <AlertTriangle className="h-3 w-3" /> {a.text}
                </Link>
              ) : (
                <span key={i} className={`pill ${a.kind === 'closing' ? 'pill-bow' : 'pill-warn'}`}>
                  <AlertTriangle className="h-3 w-3" /> {a.text}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Coluna lateral: números do dia, mais vendidos e vendas por horário. */
export function DaySidebar({ report }: { report: DailyReport }) {
  const maxHour = report.byHour.reduce((m, h) => Math.max(m, h.total), 0);
  return (
    <div className="space-y-6 lg:col-span-2">
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Vendas" value={String(report.salesCount)} />
        <Stat label="Ticket médio" value={brl(report.avgTicket)} />
        <Stat label="Itens vendidos" value={String(report.itemsSold)} />
        <Stat
          label="Estornos"
          value={report.refunds.count ? brl(report.refunds.total) : '—'}
          sub={report.refunds.count ? `${report.refunds.count} venda(s)` : undefined}
        />
        {report.discounts > 0 && <Stat label="Descontos dados" value={brl(report.discounts)} />}
        {report.cardInterest > 0 && <Stat label="Juros do cartão" value={brl(report.cardInterest)} />}
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-lg text-foreground">Mais vendidos</h2>
        </div>
        {report.topProducts.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sem vendas neste dia.</p>
        ) : (
          <ol className="divide-y divide-border">
            {report.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-5 font-heading text-base text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.quantity} un.</span>
                <span className="w-24 text-right font-medium tabular-nums text-foreground">{brl(p.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {report.byHour.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg text-foreground">Vendas por horário</h2>
          <div className="space-y-1.5">
            {report.byHour.map((h) => (
              <div key={h.hour} className="flex items-center gap-3 text-xs">
                <span className="w-10 tabular-nums text-muted-foreground">{String(h.hour).padStart(2, '0')}h</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${maxHour ? Math.max(4, (h.total / maxHour) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-20 text-right tabular-nums text-foreground">{brl(h.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/vendas"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40"
      >
        <span className="flex items-center gap-2 text-foreground">
          <PackageSearch className="h-4 w-4 text-primary" /> Ver as vendas uma a uma
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

// ---------- peças ----------
export function MethodCard({
  icon,
  label,
  value,
  refunded,
  detail,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  refunded: number;
  detail?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="rounded-lg bg-accent-soft p-1.5 text-primary">{icon}</span>
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mt-3 font-heading text-3xl font-semibold tabular-nums text-foreground">{brl(value)}</div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      {refunded > 0 && <p className="mt-1 text-xs text-danger">Inclui estorno de {brl(refunded)}</p>}
      {extra}
    </div>
  );
}

/** "Cai na conta R$ X · taxa R$ Y" — ou convite para cadastrar as taxas. */
export function FeeLine({ configured, value, fee, deposit }: { configured: boolean; value: number; fee: number; deposit: number }) {
  if (!value) return null;
  if (!configured) {
    return (
      <Link href="/configuracoes#taxas" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
        <Percent className="h-3 w-3" /> Cadastrar taxas para ver o que cai na conta
      </Link>
    );
  }
  return (
    <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
      Cai na conta <strong className="font-semibold tabular-nums text-foreground">{brl(deposit)}</strong>
      {fee > 0 && <span className="tabular-nums"> · taxa {brl(fee)}</span>}
    </p>
  );
}

export function MoneyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground/90">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-right tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
