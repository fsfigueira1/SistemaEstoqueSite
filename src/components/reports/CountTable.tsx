'use client';

// Conferência do caixa: tabela Sistema x Contei x Resultado e o aviso final.

import { AlertTriangle, Banknote, CheckCircle2, CreditCard, QrCode } from 'lucide-react';
import type { DailyReport } from '@/services/reportService';
import { differenceLabel } from '@/lib/closing';
import { brl } from '@/components/reports/DayReportParts';

function CountRow({
  icon,
  label,
  sub,
  expected,
  value,
  counted,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  expected: number;
  value: string;
  counted: number | null;
  onChange: (v: string) => void;
}) {
  const d = counted == null ? null : differenceLabel(counted - expected, brl);
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        {sub && <div className="mt-0.5 pl-6 text-[11px] tabular-nums text-muted-foreground">{sub}</div>}
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{brl(expected)}</td>
      <td className="px-4 py-3">
        <div className="relative w-32">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            R$
          </span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0,00"
            aria-label={`Valor contado — ${label}`}
            className="w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-2 text-right tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {d ? (
          <span className={`pill ${d.tone === 'ok' ? 'pill-ok' : d.tone === 'short' ? 'pill-danger' : 'pill-warn'}`}>
            {d.tone === 'ok' && <CheckCircle2 className="h-3 w-3" />}
            {d.text}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

export function ResultBanner({ diff }: { diff: number }) {
  const d = differenceLabel(diff, brl);
  const cls =
    d.tone === 'ok'
      ? 'border-success/30 bg-success/10 text-success'
      : d.tone === 'short'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : 'border-warning/40 bg-warning/15 text-warning-foreground';
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cls}`}>
      {d.tone === 'ok' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      <div>
        <p className="font-heading text-lg font-semibold">{d.tone === 'ok' ? 'Bateu certinho' : d.text}</p>
        <p className="text-xs opacity-80">
          {d.tone === 'ok'
            ? 'O que foi contado é igual ao que o sistema registrou.'
            : 'Diferença somando as formas que você contou. Confira troco, vendas não lançadas e estornos.'}
        </p>
      </div>
    </div>
  );
}

type CountKey = 'countedCash' | 'countedCard' | 'countedPix';

/** Tabela Sistema x Contei x Resultado da conferência. */
export function CountTable({
  report,
  calc,
  form,
  onChange,
}: {
  report: DailyReport;
  calc: {
    expected: { expectedCash: number; expectedCard: number; expectedPix: number };
    counted: { countedCash: number | null; countedCard: number | null; countedPix: number | null };
    cashFloat: number;
    withdrawals: number;
  };
  form: Record<CountKey, string>;
  onChange: (k: CountKey, v: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 font-semibold">Forma</th>
            <th className="px-4 py-2.5 text-right font-semibold">Sistema</th>
            <th className="px-4 py-2.5 font-semibold">Contei</th>
            <th className="px-4 py-2.5 text-right font-semibold">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <CountRow
            icon={<Banknote className="h-4 w-4" />}
            label="Dinheiro na gaveta"
            sub={
              calc.cashFloat || calc.withdrawals
                ? `${brl(calc.cashFloat)} + ${brl(report.net.cash)}${calc.withdrawals ? ` − ${brl(calc.withdrawals)}` : ''}`
                : undefined
            }
            expected={calc.expected.expectedCash}
            value={form.countedCash}
            counted={calc.counted.countedCash}
            onChange={(v) => onChange('countedCash', v)}
          />
          <CountRow
            icon={<CreditCard className="h-4 w-4" />}
            label="Cartão (maquininha)"
            sub={report.fees.configured && report.net.card ? `Na conta, após taxas: ${brl(report.deposit.card)}` : undefined}
            expected={calc.expected.expectedCard}
            value={form.countedCard}
            counted={calc.counted.countedCard}
            onChange={(v) => onChange('countedCard', v)}
          />
          <CountRow
            icon={<QrCode className="h-4 w-4" />}
            label="Pix (extrato)"
            sub={report.fees.configured && report.fees.pix ? `Na conta, após taxas: ${brl(report.deposit.pix)}` : undefined}
            expected={calc.expected.expectedPix}
            value={form.countedPix}
            counted={calc.counted.countedPix}
            onChange={(v) => onChange('countedPix', v)}
          />
        </tbody>
      </table>
    </div>
  );
}
