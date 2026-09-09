'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Receipt, Loader2, XCircle, Search, Printer, Trash2 } from 'lucide-react';
import { ReceiptPrint, type ReceiptData } from '@/components/pdv/ReceiptPrint';

// método do banco -> forma usada no comprovante
const METHOD_TO_RECEIPT: Record<string, ReceiptData['paymentMethod']> = {
  CASH: 'dinheiro',
  PIX: 'pix',
  CREDIT_CARD: 'cartao',
  DEBIT_CARD: 'cartao',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saleToReceipt(sale: any): ReceiptData {
  const pay = sale.payments?.[0];
  const subtotal = Number(sale.subtotal) - Number(sale.discountAmount || 0);
  const total = Number(sale.totalAmount);
  return {
    saleId: sale.saleNumber,
    date: sale.createdAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (sale.items ?? []).map((it: any) => ({
      name: it.product?.name ?? 'Produto',
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      total: Number(it.totalAmount),
    })),
    subtotal,
    paymentMethod: METHOD_TO_RECEIPT[pay?.method] ?? 'dinheiro',
    interest: Math.max(0, total - subtotal),
    total,
    installments: pay?.installmentCount ?? 1,
    installmentValue: pay?.installmentCount > 1 ? total / pay.installmentCount : 0,
    received: Number(sale.paidAmount) || total,
    change: Number(sale.changeAmount) || 0,
  };
}

const brl = (v: unknown) => {
  const n =
    typeof v === 'number'
      ? v
      : v && typeof v === 'object' && 'toNumber' in v
        ? (v as { toNumber: () => number }).toNumber()
        : Number(v) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

const STATUS: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: 'Concluída', cls: 'pill-ok' },
  PENDING: { label: 'Pendente', cls: 'pill-warn' },
  CANCELLED: { label: 'Cancelada', cls: 'pill-muted' },
  REFUNDED: { label: 'Estornada', cls: 'pill-danger' },
};

const METHOD_PT: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
};

type SaleRow = {
  id: string;
  saleNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  customer?: { name?: string } | null;
  createdBy?: { name?: string } | null;
  payments?: Array<{ method: string }>;
  _count?: { items: number };
};

type Period = 'today' | '7d' | '30d' | 'month' | 'all';

function rangeFor(p: Period): { startDate?: string; endDate?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  if (p === 'today') {
    return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate())) };
  }
  if (p === '7d') return { startDate: iso(new Date(now.getTime() - 7 * 864e5)) };
  if (p === '30d') return { startDate: iso(new Date(now.getTime() - 30 * 864e5)) };
  if (p === 'month') return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)) };
  return {};
}

export default function VendasPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [status, setStatus] = useState<'all' | keyof typeof STATUS>('all');
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = rangeFor(period);
      const qs = new URLSearchParams({ limit: '200', page: '1' });
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
      if (status !== 'all') qs.set('status', status);
      const res = await fetch(`/api/sales?${qs}`);
      const data = await res.json();
      setRows(data?.data?.sales ?? []);
    } finally {
      setLoading(false);
    }
  }, [period, status]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const done = rows.filter((r) => r.status === 'COMPLETED');
    const revenue = done.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    return {
      count: rows.length,
      completed: done.length,
      revenue,
      avg: done.length ? revenue / done.length : 0,
    };
  }, [rows]);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Vendas</h1>
            <p className="text-sm text-muted-foreground">Histórico e desempenho das vendas realizadas</p>
          </div>
        </div>

        {/* filtros */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card shadow-sm p-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(
              [
                ['today', 'Hoje'],
                ['7d', '7 dias'],
                ['30d', '30 dias'],
                ['month', 'Este mês'],
                ['all', 'Tudo'],
              ] as [Period, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40"
          >
            <option value="all">Todos os status</option>
            <option value="COMPLETED">Concluídas</option>
            <option value="PENDING">Pendentes</option>
            <option value="CANCELLED">Canceladas</option>
            <option value="REFUNDED">Estornadas</option>
          </select>
        </div>

        {/* resumo do período */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card label="Vendas no período" value={String(summary.count)} />
          <Card label="Concluídas" value={String(summary.completed)} />
          <Card label="Faturamento" value={brl(summary.revenue)} accent />
          <Card label="Ticket médio" value={brl(summary.avg)} />
        </div>

        {/* tabela */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Search className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
              Nenhuma venda nesse período.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Venda</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-center">Itens</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Operador</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS[r.status] ?? { label: r.status, cls: 'pill-muted' };
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">#{r.saleNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{r._count?.items ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.payments?.[0] ? METHOD_PT[r.payments[0].method] ?? r.payments[0].method : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.createdBy?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{brl(r.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && <SaleDetail id={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </Layout>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-primary/30 bg-accent-soft' : 'border-border bg-card'}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function SaleDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [askHardDelete, setAskHardDelete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sales/${id}`);
        const data = await res.json();
        if (data.success) setSale(data.data);
        else setErr(data?.error || 'Falha ao carregar a venda');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const cancel = async () => {
    if (!window.confirm('Cancelar esta venda pendente?')) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data?.error?.message || data?.error || 'Não foi possível cancelar');
        return;
      }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const refund = async () => {
    if (!window.confirm('Estornar esta venda? O estoque será devolvido e o pagamento marcado como estornado.'))
      return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sales/${id}/refund`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data?.error?.message || data?.error || 'Não foi possível estornar');
        return;
      }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const hardDelete = async (restock: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sales/${id}?hard=1${restock ? '&restock=1' : ''}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data?.error?.message || data?.error || 'Não foi possível excluir a venda');
        return;
      }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const st = sale ? STATUS[sale.status] ?? { label: sale.status, cls: 'pill-muted' } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {loading ? 'Venda' : `Venda #${sale?.saleNumber ?? ''}`}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Fechar">
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {err && (
          <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>
        )}

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sale ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
              <span>{new Date(sale.createdAt).toLocaleString('pt-BR')}</span>
              {st && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>}
              <span>Operador: {sale.createdBy?.name ?? '—'}</span>
              <span>Cliente: {sale.customer?.name ?? 'Consumidor'}</span>
            </div>

            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                Itens
              </div>
              <ul className="divide-y divide-border">
                {sale.items?.map((it: any) => (
                  <li key={it.id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="text-foreground">
                      {it.quantity}× {it.product?.name ?? 'Produto'}
                    </span>
                    <span className="font-medium text-foreground">{brl(it.totalAmount)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <Row label="Subtotal" value={brl(sale.subtotal)} />
              {Number(sale.discountAmount) > 0 && <Row label="Desconto" value={`- ${brl(sale.discountAmount)}`} />}
              {(() => {
                const juros =
                  Number(sale.totalAmount) - (Number(sale.subtotal) - Number(sale.discountAmount));
                return juros > 0.005 ? <Row label="Juros do cartão" value={brl(juros)} /> : null;
              })()}
              <Row label="Total" value={brl(sale.totalAmount)} bold />
              {sale.changeAmount > 0 && <Row label="Troco" value={brl(sale.changeAmount)} />}
            </div>

            {sale.payments?.length > 0 && (
              <div className="rounded-lg border border-border px-3 py-2">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Pagamento</div>
                {sale.payments.map((pm: any) => (
                  <div key={pm.id} className="flex justify-between text-foreground/90">
                    <span>
                      {METHOD_PT[pm.method] ?? pm.method}
                      {pm.installmentCount > 1 ? ` ${pm.installmentCount}x` : ''}
                    </span>
                    <span>{brl(pm.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-3">
              <button
                onClick={() => setPrinting(true)}
                disabled={busy || printing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                {printing ? 'Imprimindo…' : 'Reimprimir comprovante'}
              </button>

              {sale.status === 'PENDING' && (
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="w-full rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancelar venda
                </button>
              )}
              {sale.status === 'COMPLETED' && (
                <button
                  onClick={refund}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Estornar venda (devolve o estoque)
                </button>
              )}

              {!askHardDelete ? (
                <button
                  onClick={() => setAskHardDelete(true)}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/40 px-4 py-2 font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir venda do histórico
                </button>
              ) : (
                <div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-medium text-foreground">Apagar esta venda de vez?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Remove a venda, os itens e os pagamentos. Não dá pra desfazer.
                  </p>
                  <div className="mt-3 grid gap-2">
                    {sale.status === 'COMPLETED' && (
                      <button
                        onClick={() => hardDelete(true)}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 rounded-lg bg-danger px-3 py-2 text-sm font-medium text-danger-foreground transition-colors hover:bg-danger/90 disabled:opacity-50"
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        Apagar e devolver ao estoque
                      </button>
                    )}
                    <button
                      onClick={() => hardDelete(false)}
                      disabled={busy}
                      className="flex items-center justify-center gap-2 rounded-lg border border-danger/50 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Apagar sem mexer no estoque
                    </button>
                    <button
                      onClick={() => setAskHardDelete(false)}
                      disabled={busy}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {printing && (
              <div className="h-0 overflow-hidden">
                <ReceiptPrint
                  autoPrint
                  showButton={false}
                  data={saleToReceipt(sale)}
                  onPrintComplete={() => setPrinting(false)}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-bold text-foreground' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
