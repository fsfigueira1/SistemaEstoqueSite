'use client';

import React from 'react';
import { getSettings } from '@/lib/settings';
import { receiptHtml, type ReceiptData } from '@/lib/receiptHtml';
import { printThermal } from '@/lib/printClient';

export type { ReceiptData } from '@/lib/receiptHtml';

interface ReceiptPrintProps {
  data: ReceiptData;
  onPrintComplete?: () => void;
  /** false: não renderiza o botão "Imprimir" (o PDV controla a impressão) */
  showButton?: boolean;
  /** true: dispara a impressão sozinho assim que monta */
  autoPrint?: boolean;
}

/**
 * Comprovante de compra (NÃO fiscal) para a térmica Epson TM-T20X (80 mm).
 * A página é montada em src/lib/receiptHtml.ts (cupom de 70 mm, @page sem
 * margem, só preto no branco) e impressa:
 * - no app instalado: numa janela oculta, direto na impressora salva, com a
 *   altura medida depois de carregar tudo (electron/thermalPrint.cjs);
 * - no navegador: por um iframe escondido, com o diálogo de impressão.
 */
export function ReceiptPrint({ data, onPrintComplete, showButton = true, autoPrint = false }: ReceiptPrintProps) {
  const [cfg] = React.useState(() => getSettings());
  const autoStarted = React.useRef(false);
  const busy = React.useRef(false);

  const handlePrint = React.useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const html = receiptHtml(
        data,
        {
          name: cfg.companyName || 'LAÇOLARIA',
          tagline: cfg.companyTagline,
          doc: cfg.receiptShowCompany ? cfg.companyDoc : '',
          address: cfg.receiptShowCompany ? cfg.companyAddress : '',
          phone: cfg.receiptShowCompany ? cfg.companyPhone : '',
          footer: cfg.receiptFooter,
        },
        cfg.receiptWidth === '58mm' ? '58mm' : '80mm',
      );
      await printThermal(html, cfg.receiptWidth === '58mm' ? '58mm' : '80mm');
    } catch {
      // ignora — o finally libera a tela do mesmo jeito
    } finally {
      busy.current = false;
      onPrintComplete?.();
    }
  }, [data, cfg, onPrintComplete]);

  React.useEffect(() => {
    if (!autoPrint || autoStarted.current) return;
    autoStarted.current = true;
    void handlePrint();
  }, [autoPrint, handlePrint]);

  if (!showButton) return null;
  return (
    <button
      type="button"
      onClick={handlePrint}
      className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
    >
      Imprimir comprovante
    </button>
  );
}
