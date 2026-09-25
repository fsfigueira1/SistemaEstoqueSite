'use client';

// Uma linha do orçamento da lista escolar: quantidade, produto escolhido
// (com as sugestões e busca) e se tem em estoque.

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { CatalogProduct } from '@/lib/schoolList';

export type Row = {
  key: string;
  raw: string;
  text: string;
  qty: number;
  skip: boolean;
  product: CatalogProduct | null;
  options: CatalogProduct[];
};

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type ApiProduct = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string;
  salePrice: number | string;
  stockQuantity: number;
  category?: { name: string } | null;
};

const toCatalog = (p: ApiProduct): CatalogProduct => ({
  id: p.id,
  name: p.name,
  barcode: p.barcode,
  sku: p.sku,
  salePrice: Math.round(Number(p.salePrice) * 100) / 100,
  stock: p.stockQuantity,
  category: p.category?.name ?? null,
});

function StockPill({ row, take }: { row: Row; take: number }) {
  if (row.skip) return <span className="pill pill-muted">Fora</span>;
  if (!row.product) return <span className="pill pill-danger">Não achei</span>;
  if (take <= 0) return <span className="pill pill-danger">Sem estoque</span>;
  if (take < row.qty) return <span className="pill pill-warn">Só tem {take}</span>;
  return <span className="pill pill-ok">Tem</span>;
}

function ProductSearch({ initial, onPick, onClose }: { initial: string; onPick: (p: CatalogProduct) => void; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<CatalogProduct[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setRes([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products?search=${encodeURIComponent(q.trim())}&limit=8&status=ACTIVE`).then((x) => x.json());
        setRes(((r?.data?.products ?? []) as ApiProduct[]).map(toCatalog));
      } catch {
        setRes([]);
      }
    }, 250);
  }, [q]);
  return (
    <div className="mt-1.5 rounded-lg border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome ou código do produto"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar busca">
          <X className="h-4 w-4" />
        </button>
      </div>
      {res.length > 0 && (
        <ul className="mt-1.5 max-h-48 divide-y divide-border overflow-auto text-sm">
          {res.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center justify-between gap-2 px-1 py-1.5 text-left hover:bg-muted"
              >
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {brl(p.salePrice)} · {p.stock} un.
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QuoteRow({
  row,
  take,
  onChange,
}: {
  row: Row;
  /** Quanto dá para atender (o estoque é dividido entre linhas do mesmo produto). */
  take: number;
  onChange: (patch: Partial<Row>) => void;
}) {
  const [searching, setSearching] = useState(false);
  return (
    <tr className={row.skip ? 'opacity-45' : ''}>
      <td className="px-3 py-2.5 align-top">
        <input
          type="checkbox"
          checked={!row.skip}
          onChange={(e) => onChange({ skip: !e.target.checked })}
          className="mt-2 h-4 w-4"
          aria-label="Incluir no orçamento"
        />
      </td>
      <td className="px-2 py-2.5 align-top">
        <input
          type="number"
          min={1}
          value={row.qty}
          onChange={(e) => onChange({ qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
          className="w-16 rounded-lg border border-border bg-card px-2 py-1.5 text-right tabular-nums"
          aria-label="Quantidade"
        />
      </td>
      <td className="px-2 py-2.5 align-top">
        <p className="text-[11px] text-muted-foreground" title={row.raw}>
          Na lista: <span className="text-foreground/80">{row.text}</span>
        </p>
        <select
          value={row.product?.id ?? ''}
          onChange={(e) => {
            if (e.target.value === '__search') {
              setSearching(true);
              return;
            }
            onChange({ product: row.options.find((o) => o.id === e.target.value) ?? null });
          }}
          className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
          aria-label="Produto da loja"
        >
          <option value="">— Não temos / escolher —</option>
          {row.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {brl(o.salePrice)} · {o.stock > 0 ? `${o.stock} em estoque` : 'sem estoque'}
            </option>
          ))}
          <option value="__search">Buscar outro produto…</option>
        </select>
        {searching && (
          <ProductSearch
            initial={row.text}
            onClose={() => setSearching(false)}
            onPick={(p) => {
              onChange({ product: p, options: row.options.some((o) => o.id === p.id) ? row.options : [p, ...row.options] });
              setSearching(false);
            }}
          />
        )}
      </td>
      <td className="px-2 py-2.5 text-center align-top">
        <div className="mt-1.5">
          <StockPill row={row} take={take} />
        </div>
      </td>
      <td className="px-3 py-2.5 text-right align-top tabular-nums">
        <div className="mt-2 text-muted-foreground">{row.product ? brl(row.product.salePrice) : '—'}</div>
      </td>
      <td className="px-4 py-2.5 text-right align-top font-medium tabular-nums text-foreground">
        <div className="mt-2">{row.product && !row.skip && take > 0 ? brl(take * row.product.salePrice) : '—'}</div>
      </td>
    </tr>
  );
}
