'use client';

// Prévia da importação: o que é novo, o que atualiza, custo, preço (editável)
// e o lucro sobre o custo comparado com a meta da loja.

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ImportRow } from '@/lib/productImport';
import type { PreviewItem } from '@/services/productImportService';
import { priceForTarget, profitPercent } from '@/lib/profit';
import { parseMoney } from '@/lib/closing';

const brl = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Campo de preço em reais ("6,50"); grava ao sair do campo ou com Enter. */
function PriceInput({ value, label, onCommit }: { value: number | null; label: string; onCommit: (v: number | null) => void }) {
  const commit = (raw: string) => {
    const v = parseMoney(raw);
    if (v !== value) onCommit(v);
  };
  return (
    <input
      inputMode="decimal"
      defaultValue={value == null ? '' : value.toFixed(2).replace('.', ',')}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
      }}
      className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-right tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40"
      aria-label={label}
    />
  );
}

export default function ImportTable({
  rows,
  preview,
  target,
  onPrice,
  skip,
  onSkip,
}: {
  rows: ImportRow[];
  preview: Map<number, PreviewItem>;
  target: number;
  onPrice: (line: number, price: number | null) => void;
  skip: Set<number>;
  onSkip: (line: number, v: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="w-8 px-3 py-2.5" />
            <th className="px-2 py-2.5 font-semibold">Produto</th>
            <th className="px-2 py-2.5 text-right font-semibold">Entrada</th>
            <th className="px-2 py-2.5 text-right font-semibold">Custo</th>
            <th className="px-2 py-2.5 text-right font-semibold">Mercado</th>
            <th className="px-2 py-2.5 text-right font-semibold">Preço</th>
            <th className="px-4 py-2.5 text-right font-semibold">Lucro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const pv = preview.get(r.line);
            const off = skip.has(r.line) || pv?.status === 'error';
            const lucro = profitPercent(r.cost, r.price);
            const ok = lucro != null && lucro >= target - 0.05;
            const minPrice = priceForTarget(r.cost, target);
            return (
              <tr key={r.line} className={off ? 'opacity-45' : ''}>
                <td className="px-3 py-2.5 align-top">
                  <input
                    type="checkbox"
                    checked={!off}
                    disabled={pv?.status === 'error'}
                    onChange={(e) => onSkip(r.line, !e.target.checked)}
                    className="mt-1 h-4 w-4"
                    aria-label="Importar esta linha"
                  />
                </td>
                <td className="px-2 py-2.5 align-top">
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{r.barcode ?? r.sku}</span>
                    {r.category && <span>· {r.category}</span>}
                    {r.supplier && <span>· {r.supplier}</span>}
                    {pv?.status === 'new' && <span className="pill pill-ok">Novo</span>}
                    {pv?.status === 'update' && (
                      <span className="pill pill-bow" title={pv.currentName}>
                        Já existe · estoque {pv.currentStock}
                      </span>
                    )}
                    {pv?.alreadyImported && <span className="pill pill-warn">Estoque já lançado por esta planilha</span>}
                    {pv?.status === 'error' && <span className="pill pill-danger">{pv.message}</span>}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right align-top tabular-nums">{r.qty}</td>
                <td className="px-2 py-2.5 text-right align-top tabular-nums text-muted-foreground">{brl(r.cost)}</td>
                <td className="px-2 py-2.5 text-right align-top tabular-nums text-muted-foreground">
                  {r.market?.median != null ? brl(r.market.median) : '—'}
                </td>
                <td className="px-2 py-2.5 text-right align-top">
                  <PriceInput
                    key={`${r.line}-${r.price}`}
                    value={r.price}
                    label={`Preço de venda — ${r.name}`}
                    onCommit={(v) => onPrice(r.line, v)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right align-top">
                  {lucro == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className={`pill ${ok ? 'pill-ok' : 'pill-danger'}`}>
                      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {lucro.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </span>
                  )}
                  {!ok && minPrice != null && lucro != null && (
                    <button
                      type="button"
                      onClick={() => onPrice(r.line, minPrice)}
                      className="mt-1 block w-full text-right text-[11px] text-primary hover:underline"
                    >
                      Usar {brl(minPrice)} ({target}%)
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
