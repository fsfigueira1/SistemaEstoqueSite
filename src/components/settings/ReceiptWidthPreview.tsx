'use client';

import type { StoreSettings } from '@/lib/settings';

// Espelha as margens cegas reais usadas na impressão (ver @media print em
// globals.css / ReceiptPrint.tsx): 80mm tem folga assimétrica pela zona não
// imprimível da Epson TM-T20X; 58mm usa recuo simétrico.
export default function ReceiptWidthPreview({
  width,
  storeName,
}: {
  width: StoreSettings['receiptWidth'];
  storeName: string;
}) {
  const isNarrow = width === '58mm';
  const padRight = isNarrow ? '5mm' : '2mm';
  const printable = isNarrow ? '48mm' : '73mm';

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
      <p className="mb-3 text-center text-xs text-muted-foreground">
        Pré-visualização — bobina de {width === '58mm' ? '58 mm' : '80 mm'} (área imprimível ≈ {printable}, sempre
        centralizada)
      </p>
      <div
        className="mx-auto rounded-sm border border-border bg-white shadow-sm transition-[width] duration-200"
        style={{ width, boxSizing: 'border-box', padding: `3mm ${padRight} 3mm 5mm` }}
      >
        <div className="text-center text-[11px] font-bold text-black">{storeName || 'LAÇOLARIA'}</div>
        <div className="my-1.5 border-t border-dashed border-black/40" />
        <div className="flex justify-between gap-2 text-[9px] text-black">
          <span>2 x R$ 11,50</span>
          <span>R$ 23,00</span>
        </div>
        <div className="my-1.5 border-t border-dashed border-black/40" />
        <div className="flex justify-between gap-2 text-[11px] font-bold text-black">
          <span>TOTAL</span>
          <span>R$ 23,00</span>
        </div>
      </div>
    </div>
  );
}
