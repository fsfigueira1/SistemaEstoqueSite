'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ShelfLabelData } from './ShelfLabel';
import { LabelSheet, PAPERS, type PaperSize, type SheetOptions } from './LabelSheet';
import { chunk } from './labelProducts';

type ElectronLabelsAPI = {
  printLabels?: (paper: PaperSize) => Promise<{ ok?: boolean; reason?: string }>;
};

/**
 * Monta as folhas num portal direto no <body> (ver #labels-print-area no
 * globals.css), dispara a impressão e avisa quando terminou.
 * No app instalado usa o IPC "print-labels" (A4/A3, margem zero, escala 100%);
 * no navegador cai no window.print().
 * onDone(printed): printed = false quando a impressão foi cancelada/falhou.
 */
export function LabelPrintArea({
  labels,
  options,
  onDone,
}: {
  labels: ShelfLabelData[];
  options: SheetOptions;
  onDone: (printed: boolean) => void;
}) {
  const p = PAPERS[options.paper];
  const sheets = useMemo(() => chunk(labels, p.cols * p.rows), [labels, p.cols, p.rows]);
  const paper = options.paper;

  useEffect(() => {
    let cancelled = false;
    // dois frames: as folhas precisam estar montadas e com layout aplicado
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        let printed = false;
        try {
          const api = (window as unknown as { electronAPI?: ElectronLabelsAPI }).electronAPI;
          if (api && typeof api.printLabels === 'function') {
            printed = Boolean((await api.printLabels(paper))?.ok);
          } else {
            // navegador: não dá para saber se cancelaram; conta como impresso
            window.print();
            printed = true;
          }
        } catch {
          printed = false;
        } finally {
          if (!cancelled) onDone(printed);
        }
      }),
    );
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [paper, onDone]);

  return createPortal(
    <div id="labels-print-area">
      <style>{`@media print { @page { size: ${paper} portrait; margin: 0; } html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; } }`}</style>
      {sheets.map((s, i) => (
        <LabelSheet key={i} labels={s} options={options} last={i === sheets.length - 1} />
      ))}
    </div>,
    document.body,
  );
}
