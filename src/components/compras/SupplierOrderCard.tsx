'use client';

// Um fornecedor na Sugestão de compra: itens com quantidade editável, total e
// botões para copiar o pedido ou mandar pelo WhatsApp.

import { useState } from 'react';
import { Check, Copy, MessageCircle, Phone, Truck, UserRoundX } from 'lucide-react';
import type { RestockGroup, RestockItem } from '@/lib/restock';
import { orderMessage, whatsappNumber } from '@/lib/restock';
import SupplierSelect from '@/components/SupplierSelect';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function UrgencyPill({ item, days }: { item: RestockItem; days: number }) {
  if (item.urgency === 'out') return <span className="pill pill-danger">Zerado</span>;
  if (item.urgency === 'soon')
    return (
      <span className="pill pill-warn">
        {item.daysLeft === 0 ? 'Acaba hoje' : `Acaba em ~${item.daysLeft} dia${item.daysLeft === 1 ? '' : 's'}`}
      </span>
    );
  if (item.urgency === 'low') return <span className="pill pill-bow">Abaixo do mínimo</span>;
  return item.daysLeft != null ? (
    <span className="text-[11px] text-muted-foreground">dura ~{item.daysLeft} dias</span>
  ) : (
    <span className="text-[11px] text-muted-foreground">sem venda em {days} dias</span>
  );
}

export default function SupplierOrderCard({
  group,
  days,
  storeName,
  qty,
  onQty,
  onAssign,
}: {
  group: RestockGroup;
  days: number;
  storeName: string;
  qty: Record<string, number>;
  onQty: (productId: string, v: number) => void;
  onAssign: (productId: string, supplierId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const s = group.supplier;
  const q = (i: RestockItem) => qty[i.productId] ?? i.suggested;

  const totals = { units: 0, cost: 0 };
  for (const i of group.items) {
    totals.units += q(i);
    totals.cost += q(i) * i.cost;
  }

  const message = () =>
    orderMessage(
      storeName,
      s,
      group.items.map((i) => ({ name: i.name, code: i.code, qty: q(i) })),
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o pedido:', message());
    }
  };

  const wa = whatsappNumber(s?.phone);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`rounded-lg p-2 ${s ? 'bg-accent-soft text-primary' : 'bg-muted text-muted-foreground'}`}>
            {s ? <Truck className="h-5 w-5" /> : <UserRoundX className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg text-foreground">{s ? s.name : 'Sem fornecedor'}</h2>
            <p className="text-xs text-muted-foreground">
              {s ? (
                <>
                  {s.contactName && <span>{s.contactName} · </span>}
                  {s.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </span>
                  ) : (
                    'sem telefone cadastrado'
                  )}
                </>
              ) : (
                'Escolha o fornecedor de cada item para ele entrar no pedido certo'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 text-right">
            <p className="font-heading text-xl font-semibold tabular-nums text-foreground">{brl(totals.cost)}</p>
            <p className="text-[11px] text-muted-foreground">{totals.units} unidades</p>
          </div>
          {s && (
            <>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar pedido'}
              </button>
              {wa && (
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(message())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-2.5 font-semibold">Produto</th>
              <th className="px-3 py-2.5 text-right font-semibold">Vendeu</th>
              <th className="px-3 py-2.5 text-right font-semibold">Tem</th>
              <th className="px-3 py-2.5 text-right font-semibold">Comprar</th>
              <th className="px-3 py-2.5 text-right font-semibold">Custo un.</th>
              <th className="px-5 py-2.5 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.items.map((i) => (
              <tr key={i.productId} className={q(i) === 0 ? 'opacity-50' : ''}>
                <td className="px-5 py-2.5">
                  <div className="font-medium text-foreground">{i.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <UrgencyPill item={i} days={days} />
                    {i.code && <span className="text-[11px] tabular-nums text-muted-foreground">{i.code}</span>}
                  </div>
                  {!s && (
                    <div className="mt-1.5 max-w-xs">
                      <SupplierSelect
                        compact
                        value=""
                        placeholder="Definir fornecedor…"
                        onChange={(id) => id && onAssign(i.productId, id)}
                        className="w-full rounded-lg border border-border bg-card px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{i.sold}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={i.stock <= 0 ? 'text-danger' : 'text-foreground'}>{i.stock}</span>
                  <span className="text-[11px] text-muted-foreground"> / mín {i.min}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <input
                    type="number"
                    min={0}
                    value={q(i)}
                    onChange={(e) => onQty(i.productId, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40"
                    aria-label={`Quantidade para comprar — ${i.name}`}
                  />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {i.cost > 0 ? brl(i.cost) : '—'}
                </td>
                <td className="px-5 py-2.5 text-right font-medium tabular-nums text-foreground">
                  {i.cost > 0 ? brl(q(i) * i.cost) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
