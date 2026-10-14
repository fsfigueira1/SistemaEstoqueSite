'use client';

import { useCallback, useState } from 'react';
import { clampCopies, MAX_COPIES, toNumber, type LabelProduct, type LabelSelection } from './labelProducts';

/** Seleção de produtos + quantidade de etiquetas de cada um. */
export function useLabelSelection() {
  const [selection, setSelection] = useState<LabelSelection>(() => new Map());

  const update = useCallback((fn: (next: Map<string, number>) => void) => {
    setSelection((s) => {
      const next = new Map(s);
      fn(next);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (id: string) =>
      update((m) => {
        if (m.has(id)) m.delete(id);
        else m.set(id, 1);
      }),
    [update],
  );

  const setQty = useCallback(
    (id: string, raw: string) =>
      update((m) => {
        const n = clampCopies(raw);
        if (n > 0) m.set(id, n);
        else m.delete(id);
      }),
    [update],
  );

  /** Marca todos da lista; se já estiverem todos marcados, desmarca. */
  const toggleAll = useCallback(
    (list: LabelProduct[], allSelected: boolean) =>
      update((m) => {
        for (const p of list) {
          if (allSelected) m.delete(p.id);
          else if (!m.has(p.id)) m.set(p.id, 1);
        }
      }),
    [update],
  );

  /** Uma etiqueta por unidade em estoque (mínimo 1) para os selecionados. */
  const qtyFromStock = useCallback(
    (products: LabelProduct[]) =>
      update((m) => {
        for (const p of products) {
          if (m.has(p.id)) m.set(p.id, Math.min(MAX_COPIES, Math.max(1, toNumber(p.stockQuantity))));
        }
      }),
    [update],
  );

  const resetQty = useCallback(
    () =>
      update((m) => {
        for (const id of m.keys()) m.set(id, 1);
      }),
    [update],
  );

  const clear = useCallback(() => setSelection(new Map()), []);

  /** Marca estes ids (1 etiqueta cada, mantendo quantidades já escolhidas). */
  const selectIds = useCallback(
    (ids: string[]) =>
      update((m) => {
        for (const id of ids) if (!m.has(id)) m.set(id, 1);
      }),
    [update],
  );

  return { selection, toggle, setQty, toggleAll, qtyFromStock, resetQty, clear, selectIds };
}
