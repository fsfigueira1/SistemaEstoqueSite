'use client';

// Configurações → "Taxas da maquininha e Pix": o % que o banco/maquininha
// desconta de cada venda. O relatório do dia usa isso para mostrar quanto de
// fato cai na conta.

import { Percent } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';

const inp =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-right tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40';

type FeeKey = 'feeDebitPercent' | 'feeCreditPercent' | 'feeCreditInstallmentPercent' | 'feePixPercent';

const FIELDS: Array<{ key: FeeKey; label: string; hint: string }> = [
  { key: 'feeDebitPercent', label: 'Débito', hint: 'ex.: 1,37' },
  { key: 'feeCreditPercent', label: 'Crédito à vista', hint: 'ex.: 3,15' },
  { key: 'feeCreditInstallmentPercent', label: 'Crédito parcelado', hint: 'ex.: 4,50' },
  { key: 'feePixPercent', label: 'Pix', hint: '0 se não paga taxa' },
];

export default function FeeSettings({
  form,
  set,
}: {
  form: StoreSettings;
  set: <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => void;
}) {
  return (
    <section id="taxas" className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-lg bg-accent-soft p-2 text-primary">
          <Percent className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg text-foreground">Taxas da maquininha e Pix</h2>
          <p className="text-xs text-muted-foreground">
            O relatório do dia mostra quanto de fato cai na conta depois das taxas
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium text-foreground/90">{f.label}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="30"
                step="0.01"
                value={form[f.key]}
                onChange={(e) => set(f.key, Math.max(0, Number(e.target.value) || 0))}
                className={inp}
                aria-label={`Taxa ${f.label} (%)`}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Os valores estão no app ou no contrato da sua maquininha. Dinheiro não tem taxa.
      </p>
    </section>
  );
}
