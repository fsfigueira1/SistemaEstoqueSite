import type { ProductStatus } from '@/generated/prisma/enums';
import type { ShelfLabelData } from './ShelfLabel';

export interface LabelCategory {
  id: string;
  name: string;
}

export interface LabelProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string;
  category?: { id: string; name: string } | null;
  salePrice: number | string;
  stockQuantity: number;
  status: ProductStatus;
  unit?: string | null;
}

/** Situação da etiqueta vinda de /api/labels. */
export interface LabelInfoDto {
  productId: string;
  compareAtPrice: number | null;
  promoUntil: string | null;
  activeCompareAt: number;
  state: 'never' | 'changed' | 'ok';
  labelPrintedAt: string | null;
}
export type LabelInfoMap = ReadonlyMap<string, LabelInfoDto>;

/** Quantidade de etiquetas por produto (ausente = não selecionado). */
export type LabelSelection = ReadonlyMap<string, number>;

export const MAX_COPIES = 999;

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export const brl = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(v));

export const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Sem código de barras cadastrado, a etiqueta usa o SKU (Code128). */
export function toLabel(p: LabelProduct, info?: LabelInfoDto): ShelfLabelData {
  return {
    name: p.name,
    price: toNumber(p.salePrice),
    code: (p.barcode ?? '').trim() || p.sku,
    category: p.category?.name ?? null,
    unit: p.unit ?? null,
    compareAt: info?.activeCompareAt ?? 0,
    promoUntil: info?.promoUntil ?? null,
  };
}

/** Lista final de etiquetas, na ordem dos produtos, repetindo cada uma `qty` vezes. */
export function expandLabels(
  products: LabelProduct[],
  selection: LabelSelection,
  info: LabelInfoMap = new Map(),
): ShelfLabelData[] {
  const out: ShelfLabelData[] = [];
  for (const p of products) {
    const qty = selection.get(p.id) ?? 0;
    if (!qty) continue;
    const data = toLabel(p, info.get(p.id));
    for (let i = 0; i < qty; i++) out.push(data);
  }
  return out;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function clampCopies(raw: unknown): number {
  return Math.min(MAX_COPIES, Math.max(0, Math.floor(toNumber(raw))));
}
