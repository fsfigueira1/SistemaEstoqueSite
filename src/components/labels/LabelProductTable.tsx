'use client';

import { Loader2, Search } from 'lucide-react';
import { ProductStatus } from '@/generated/prisma/enums';
import {
  brl,
  MAX_COPIES,
  toNumber,
  type LabelCategory,
  type LabelInfoDto,
  type LabelInfoMap,
  type LabelProduct,
  type LabelSelection,
} from './labelProducts';

const INPUT = 'rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40';

export interface LabelFilters {
  search: string;
  categoryId: string;
  status: 'all' | ProductStatus;
  inStockOnly: boolean;
  /** situação da etiqueta na gôndola */
  printState: 'all' | 'changed' | 'never' | 'promo';
}

export function LabelFiltersBar({
  filters,
  categories,
  onChange,
}: {
  filters: LabelFilters;
  categories: LabelCategory[];
  onChange: (patch: Partial<LabelFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Buscar por nome, SKU ou código de barras"
          className="w-full rounded-lg border border-border py-2 pl-9 pr-3 focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <select value={filters.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })} className={INPUT}>
        <option value="all">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value as LabelFilters['status'] })}
        className={INPUT}
      >
        <option value="all">Todos os status</option>
        <option value={ProductStatus.ACTIVE}>Ativos</option>
        <option value={ProductStatus.INACTIVE}>Inativos</option>
        <option value={ProductStatus.DISCONTINUED}>Descontinuados</option>
      </select>
      <select
        value={filters.printState}
        onChange={(e) => onChange({ printState: e.target.value as LabelFilters['printState'] })}
        className={INPUT}
      >
        <option value="all">Todas as etiquetas</option>
        <option value="changed">Preço mudou (reimprimir)</option>
        <option value="never">Nunca impressas</option>
        <option value="promo">Em oferta</option>
      </select>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={filters.inStockOnly}
          onChange={(e) => onChange({ inStockOnly: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        Só com estoque
      </label>
    </div>
  );
}

function LabelBadge({ info }: { info?: LabelInfoDto }) {
  const promo = info && info.activeCompareAt > 0;
  const base = 'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium';
  return (
    <div className="flex flex-wrap gap-1">
      {info?.state === 'changed' && <span className={`${base} bg-amber-100 text-amber-800`}>Preço mudou</span>}
      {info?.state === 'never' && <span className={`${base} bg-muted text-muted-foreground`}>Nunca impressa</span>}
      {info?.state === 'ok' && <span className={`${base} bg-emerald-100 text-emerald-800`}>Em dia</span>}
      {promo && <span className={`${base} bg-primary/15 text-primary`}>Oferta</span>}
    </div>
  );
}

function ProductRow({
  product: p,
  info,
  qty,
  onToggle,
  onQty,
}: {
  product: LabelProduct;
  info?: LabelInfoDto;
  qty: number;
  onToggle: (id: string) => void;
  onQty: (id: string, raw: string) => void;
}) {
  const noPrice = toNumber(p.salePrice) <= 0;
  return (
    <tr className={`border-b border-border last:border-0 ${qty ? 'bg-accent-soft/40' : 'hover:bg-muted/50'}`}>
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          checked={qty > 0}
          onChange={() => onToggle(p.id)}
          aria-label={`Selecionar ${p.name}`}
          className="h-4 w-4 accent-primary"
        />
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-foreground">{p.name}</div>
        <div className="text-xs text-muted-foreground">{p.category?.name ?? '—'}</div>
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
        {p.barcode || <span title="Sem código de barras: a etiqueta usa o SKU">{p.sku} (SKU)</span>}
      </td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${noPrice ? 'text-destructive' : ''}`}>
        {brl(p.salePrice)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{toNumber(p.stockQuantity)}</td>
      <td className="px-4 py-2.5">
        <LabelBadge info={info} />
      </td>
      <td className="px-4 py-2.5 text-right">
        <input
          type="number"
          min={0}
          max={MAX_COPIES}
          value={qty || ''}
          placeholder="0"
          onChange={(e) => onQty(p.id, e.target.value)}
          aria-label={`Quantidade de etiquetas de ${p.name}`}
          className="w-20 rounded-lg border border-border px-2 py-1 text-right tabular-nums focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      </td>
    </tr>
  );
}

export function LabelProductTable({
  products,
  info,
  loading,
  selection,
  allSelected,
  onToggle,
  onToggleAll,
  onQty,
}: {
  products: LabelProduct[];
  info: LabelInfoMap;
  loading: boolean;
  selection: LabelSelection;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onQty: (id: string, raw: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-sm">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Carregando produtos…
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-sm">
        Nenhum produto encontrado.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Selecionar todos da lista"
                className="h-4 w-4 accent-primary"
              />
            </th>
            <th className="px-4 py-3">Produto</th>
            <th className="px-4 py-3">Cód. barras</th>
            <th className="px-4 py-3 text-right">Preço</th>
            <th className="px-4 py-3 text-right">Estoque</th>
            <th className="px-4 py-3">Gôndola</th>
            <th className="px-4 py-3 text-right">Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              info={info.get(p.id)}
              qty={selection.get(p.id) ?? 0}
              onToggle={onToggle}
              onQty={onQty}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
