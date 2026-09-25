'use client';

// PDV → Pagamento: uma forma só (Dinheiro, Pix, Débito, Crédito) ou
// "Dividir pagamento" (ex.: parte em dinheiro e o resto no Pix/cartão).
// As contas ficam em src/lib/payments.ts.

import { Banknote, CreditCard, Plus, QrCode, Split, Wallet, X } from 'lucide-react';
import { PAY_LABEL, type PartInput, type PayMethod, type PaymentPlan } from '@/lib/payments';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const METHODS: Array<{ id: PayMethod; icon: React.ReactNode }> = [
  { id: 'CASH', icon: <Banknote className="h-4 w-4" /> },
  { id: 'PIX', icon: <QrCode className="h-4 w-4" /> },
  { id: 'DEBIT_CARD', icon: <Wallet className="h-4 w-4" /> },
  { id: 'CREDIT_CARD', icon: <CreditCard className="h-4 w-4" /> },
];
const INSTALLMENTS = [1, 2, 3, 4, 5, 6, 10, 12];

const field =
  'w-full rounded-lg border border-border bg-card px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40';

function Installments({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
      className={field}
      aria-label="Parcelas"
    >
      {INSTALLMENTS.map((n) => (
        <option key={n} value={n}>
          {n === 1 ? 'À vista' : `${n}x`}
        </option>
      ))}
    </select>
  );
}

export default function PaymentPanel({
  parts,
  setParts,
  received,
  setReceived,
  plan,
  subtotal,
  interestPercent,
}: {
  parts: PartInput[];
  setParts: (p: PartInput[]) => void;
  received: string;
  setReceived: (v: string) => void;
  plan: PaymentPlan;
  subtotal: number;
  interestPercent: number;
}) {
  const split = parts.length > 1;
  const update = (i: number, patch: Partial<PartInput>) =>
    setParts(
      parts.map((p, j) =>
        j === i
          ? {
              ...p,
              ...patch,
              ...(patch.method && patch.method !== 'CREDIT_CARD' ? { installments: 1 } : {}),
            }
          : p,
      ),
    );
  const hasCash = parts.some((p) => p.method === 'CASH');

  const startSplit = () => {
    const cur = parts[0]?.method ?? 'CASH';
    setParts([
      { method: 'CASH', amount: null },
      {
        method: cur === 'CASH' ? 'PIX' : cur,
        installments: parts[0]?.installments ?? 1,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {!split ? (
        <>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Forma de pagamento">
            {METHODS.map((m) => {
              const on = parts[0]?.method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setParts([{ method: m.id, installments: 1 }]);
                    if (m.id !== 'CASH') setReceived('');
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 text-xs font-medium transition-colors ${
                    on
                      ? 'border-primary bg-accent-soft text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {m.icon}
                  {PAY_LABEL[m.id]}
                </button>
              );
            })}
          </div>

          {parts[0]?.method === 'CREDIT_CARD' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Parcelas</label>
              <Installments value={parts[0].installments ?? 1} onChange={(n) => update(0, { installments: n })} />
            </div>
          )}

          <button
            type="button"
            onClick={startSplit}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Split className="h-4 w-4" /> Dividir pagamento
          </button>
        </>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Pagamento dividido</span>
            <button
              type="button"
              onClick={() => setParts([{ method: parts[parts.length - 1].method, installments: 1 }])}
              className="text-xs text-primary hover:underline"
            >
              Voltar para uma forma
            </button>
          </div>
          {parts.map((p, i) => {
            const last = i === parts.length - 1;
            const planned = plan.parts[i];
            return (
              <div key={i} className="space-y-1.5 rounded-lg bg-card p-2 ring-1 ring-border">
                <div className="flex items-center gap-1.5">
                  <select
                    value={p.method}
                    onChange={(e) => update(i, { method: e.target.value as PayMethod })}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
                    aria-label={`Forma ${i + 1}`}
                  >
                    {METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {PAY_LABEL[m.id]}
                      </option>
                    ))}
                  </select>
                  {last ? (
                    <span
                      className="w-28 rounded-lg bg-muted px-2 py-1.5 text-right text-sm tabular-nums text-foreground"
                      title="O restante"
                    >
                      {brl(planned?.base ?? 0)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.amount ?? ''}
                      onChange={(e) =>
                        update(i, {
                          amount: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      placeholder="0,00"
                      className="w-28 rounded-lg border border-border bg-card px-2 py-1.5 text-right text-sm tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40"
                      aria-label={`Valor em ${PAY_LABEL[p.method]}`}
                    />
                  )}
                  {parts.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setParts(parts.filter((_, j) => j !== i))}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger"
                      aria-label="Tirar esta forma"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {last && <p className="text-[11px] text-muted-foreground">O restante vai nesta forma</p>}
                {p.method === 'CREDIT_CARD' && (
                  <div className="flex items-center gap-2">
                    <div className="w-32">
                      <Installments value={p.installments ?? 1} onChange={(n) => update(i, { installments: n })} />
                    </div>
                    {planned && planned.interest > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        + juros {brl(planned.interest)} = {brl(planned.amount)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {parts.length < 4 && (
            <button
              type="button"
              onClick={() =>
                setParts([...parts.slice(0, -1), { method: 'PIX', amount: null }, parts[parts.length - 1]])
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Mais uma forma
            </button>
          )}
        </div>
      )}

      {hasCash && (
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {split ? 'Recebido em dinheiro (opcional)' : 'Valor recebido (opcional)'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder="0,00"
            className={field}
          />
        </div>
      )}

      {plan.error && subtotal > 0 && <p className="text-sm font-medium text-danger">{plan.error}</p>}

      <div className="rounded-xl border-2 border-primary/25 bg-accent-soft/50 p-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{brl(subtotal)}</span>
          </div>
          {plan.interest > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Juros do cartão ({interestPercent}%)</span>
              <span className="tabular-nums">{brl(plan.interest)}</span>
            </div>
          )}
          {split &&
            plan.parts.map((p, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>
                  {PAY_LABEL[p.method]}
                  {p.installments > 1 ? ` ${p.installments}x` : ''}
                </span>
                <span className="tabular-nums">{brl(p.amount)}</span>
              </div>
            ))}
          {plan.change > 0 && (
            <div className="flex justify-between font-medium text-foreground">
              <span>Troco</span>
              <span className="tabular-nums">{brl(plan.change)}</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-end justify-between border-t border-primary/20 pt-2">
          <span className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="font-heading text-2xl font-bold tabular-nums text-primary">{brl(plan.total)}</span>
        </div>
        {plan.parts
          .filter((p) => p.installmentValue > 0)
          .map((p, i) => (
            <div key={i} className="mt-1 text-right text-xs text-muted-foreground">
              {p.installments}× de {brl(p.installmentValue)}
            </div>
          ))}
      </div>
    </div>
  );
}
