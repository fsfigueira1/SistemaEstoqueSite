'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, PackageMinus, PackagePlus, XCircle } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';

// Ajuste de estoque de um produto: entrada, saída ou "contagem" (digita o que
// tem na prateleira e o sistema lança a diferença). Usado no Estoque e no
// cadastro de Produtos — tudo vira movimentação registrada, com observação.

export type StockAdjustMode = 'add' | 'remove' | 'set';

export interface StockAdjustProduct {
  id: string;
  name: string;
  stockQuantity: number | string;
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  notes?: string | null;
  createdAt: string;
}

const MOVE_LABEL: Record<string, [string, 1 | -1]> = {
  PURCHASE: ['Compra', 1],
  SALE: ['Venda', -1],
  SALE_RETURN: ['Devolução de venda', 1],
  PURCHASE_RETURN: ['Devolução ao fornecedor', -1],
  LOSS: ['Perda', -1],
  THEFT: ['Furto', -1],
  ADJUSTMENT_IN: ['Entrada manual', 1],
  ADJUSTMENT_OUT: ['Saída manual', -1],
  CORRECTION: ['Correção', 1],
};

const MODES: Array<{ id: StockAdjustMode; label: string; icon: typeof PackagePlus }> = [
  { id: 'add', label: 'Entrada', icon: PackagePlus },
  { id: 'remove', label: 'Saída', icon: PackageMinus },
  { id: 'set', label: 'Contagem', icon: ClipboardCheck },
];

const toInt = (s: string) => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function useRecentMovements(productId: string) {
  const [moves, setMoves] = useState<Movement[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/stock/movement?productId=${encodeURIComponent(productId)}&limit=5`)
      .then((r) => r.json())
      .then((r) => alive && setMoves(r?.success ? (r.data?.stockMovements ?? []) : []))
      .catch(() => alive && setMoves([]));
    return () => {
      alive = false;
    };
  }, [productId]);
  return moves;
}

function RecentMovements({ moves }: { moves: Movement[] | null }) {
  if (!moves?.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Últimas movimentações</div>
      <ul className="space-y-1 text-xs">
        {moves.map((m) => {
          const [label, sign] = MOVE_LABEL[m.type] ?? [m.type, 1];
          return (
            <li key={m.id} className="flex items-baseline gap-2">
              <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{shortDate(m.createdAt)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground" title={m.notes ?? undefined}>
                {label}
                {m.notes ? <span className="text-muted-foreground"> · {m.notes}</span> : null}
              </span>
              <span className={`shrink-0 font-semibold tabular-nums ${sign > 0 ? 'text-emerald-600' : 'text-danger'}`}>
                {sign > 0 ? '+' : '−'}
                {m.quantity}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StockAdjustModal({
  product,
  initialMode = 'add',
  onClose,
  onSaved,
}: {
  product: StockAdjustProduct;
  initialMode?: StockAdjustMode;
  onClose: () => void;
  /** depois de gravar, com o estoque novo */
  onSaved: (newStock: number) => void;
}) {
  const [mode, setMode] = useState<StockAdjustMode>(initialMode);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const moves = useRecentMovements(product.id);

  const current = Number(product.stockQuantity) || 0;
  const n = toInt(qty);
  const valid = qty.trim() !== '' && Number.isInteger(n) && (mode === 'set' ? n >= 0 : n > 0);
  let after: number | null = null;
  if (valid) after = mode === 'add' ? current + n : mode === 'remove' ? current - n : n;

  const submit = async () => {
    if (!valid) {
      setErr(mode === 'set' ? 'Informe quantas unidades há (0 ou mais, número inteiro)' : 'Informe uma quantidade inteira maior que zero');
      return;
    }
    if (mode === 'set' && n === current) {
      setErr('O estoque já está com essa quantidade.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/stock/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode === 'set' ? 'adjust' : mode,
          productId: product.id,
          quantity: n,
          notes: note.trim() || (mode === 'set' ? 'Contagem de estoque' : undefined),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(errorText(data, 'Não foi possível ajustar o estoque'));
        return;
      }
      // já gravou: avisa e fecha (ninguém reenvia achando que não foi)
      const fresh = Number(data.data?.product?.stockQuantity);
      onSaved(Number.isFinite(fresh) ? fresh : (after ?? current));
    } catch {
      setErr('Sem conexão');
    } finally {
      setSaving(false);
    }
  };

  const qtyLabel = { add: 'Quantidade a adicionar', remove: 'Quantidade a remover', set: 'Quantidade contada na prateleira' }[mode];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-adjust-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="stock-adjust-title" className="text-xl font-bold text-foreground">
            Ajustar estoque
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {product.name} · estoque atual <span className="font-semibold text-foreground">{current}</span>
        </p>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setErr(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors ${
                mode === id ? 'border-primary bg-accent-soft text-accent-soft-foreground' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">
            {qtyLabel} <span className="text-danger">*</span>
          </span>
          <input
            autoFocus
            type="number"
            min={mode === 'set' ? 0 : 1}
            step="1"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
            placeholder="0"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {mode === 'set'
              ? 'Conte o que há na loja e digite o total — o sistema lança a diferença sozinho.'
              : 'Use para compra sem pedido, perda, quebra ou correção.'}
          </span>
        </label>

        {after !== null && (
          <p className={`mt-3 text-sm ${after < 0 ? 'text-danger' : 'text-foreground'}`}>
            Fica: <b className="tabular-nums">{current}</b> → <b className="tabular-nums">{after}</b>
            {after < 0 && ' (não pode ficar negativo)'}
          </p>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-foreground">Observação</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
            placeholder={mode === 'remove' ? 'Ex.: quebrou, vencido, uso interno' : 'Ex.: compra NF 12345, erro de digitação'}
          />
        </label>

        {err && (
          <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {err}
          </div>
        )}

        <RecentMovements moves={moves} />

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || (after !== null && after < 0)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
