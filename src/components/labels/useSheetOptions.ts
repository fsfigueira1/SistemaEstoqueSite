'use client';

import { useCallback, useEffect, useState } from 'react';
import { MAX_OFFSET_MM, PAPERS, type SheetOptions } from './LabelSheet';

// Calibração da folha é da impressora deste PC (cada impressora desloca um
// pouco diferente), por isso fica no localStorage e não no banco.
const KEY = 'lacolaria_label_sheet';
const DEFAULTS: SheetOptions = { paper: 'A4', cutLines: true, cropMarks: true, offsetX: 0, offsetY: 0 };

const clampOffset = (v: unknown) => {
  const n = Math.round(Number(v) * 10) / 10;
  return Number.isFinite(n) ? Math.max(-MAX_OFFSET_MM, Math.min(MAX_OFFSET_MM, n)) : 0;
};

function sanitize(raw: Partial<SheetOptions>): SheetOptions {
  return {
    paper: raw.paper && raw.paper in PAPERS ? raw.paper : DEFAULTS.paper,
    cutLines: typeof raw.cutLines === 'boolean' ? raw.cutLines : DEFAULTS.cutLines,
    cropMarks: typeof raw.cropMarks === 'boolean' ? raw.cropMarks : DEFAULTS.cropMarks,
    offsetX: clampOffset(raw.offsetX ?? 0),
    offsetY: clampOffset(raw.offsetY ?? 0),
  };
}

export function useSheetOptions() {
  const [options, setOptions] = useState<SheetOptions>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setOptions(sanitize(JSON.parse(raw)));
    } catch {
      /* sem localStorage: fica o padrão */
    }
  }, []);

  const patch = useCallback((p: Partial<SheetOptions>) => {
    setOptions((o) => {
      const next = sanitize({ ...o, ...p });
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  }, []);

  return { options, patch };
}
