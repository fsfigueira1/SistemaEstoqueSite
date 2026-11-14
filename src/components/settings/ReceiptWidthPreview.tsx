'use client';

import type { StoreSettings } from '@/lib/settings';
import { THERMAL } from '@/lib/thermalPrint';

// Espelha as medidas reais da impressão (src/lib/thermalPrint.ts): cupom de
// 70 mm (80 mm) ou 48 mm (58 mm), com 5 mm de recuo à esquerda por causa da
// zona não imprimível da Epson TM-T20X.
export default function ReceiptWidthPreview({
  width,
  storeName,
}: {
  width: StoreSettings['receiptWidth'];
  storeName: string;
}) {
  const t = THERMAL[width === '58mm' ? '58mm' : '80mm'];

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
      <p className="mb-3 text-center text-xs text-muted-foreground">
        Pré-visualização — bobina de {t.paper} mm (texto em {t.content} mm, recuo de {t.left} mm à esquerda)
      </p>
      <div
        className="mx-auto rounded-sm border border-border bg-white shadow-sm transition-[width] duration-200"
        style={{
          width: `${t.paper}mm`,
          boxSizing: 'border-box',
          padding: `3mm ${t.paper - t.content - t.left}mm 3mm ${t.left}mm`,
        }}
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
