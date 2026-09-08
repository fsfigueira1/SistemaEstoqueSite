'use client';

import React from 'react';
import { getSettings } from '@/lib/settings';

function formatCurrency(value: unknown): string {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseFloat(value.replace(',', '.')) || 0
        : value && typeof value === 'object' && 'toNumber' in value
          ? (value as { toNumber: () => number }).toNumber()
          : 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  saleId: string;
  date: Date | string;
  items: ReceiptItem[];
  subtotal: number;
  paymentMethod: 'dinheiro' | 'pix' | 'cartao';
  interest?: number;
  total: number;
  installments?: number;
  installmentValue?: number;
  received?: number;
  change?: number;
}

interface ReceiptPrintProps {
  data: ReceiptData;
  onPrintComplete?: () => void;
}

const METHOD_LABEL: Record<string, string> = {
  dinheiro: 'DINHEIRO',
  pix: 'PIX',
  cartao: 'CARTAO CREDITO',
};

/**
 * Comprovante de compra (NÃO fiscal) formatado para impressora térmica
 * Epson TM-T20X — bobina de 80mm, área de impressão ~72mm.
 * Não imprime sozinho: o operador decide pelo botão.
 */
export function ReceiptPrint({ data, onPrintComplete }: ReceiptPrintProps) {
  const [cfg] = React.useState(() => getSettings());
  const storeName = cfg.companyName || 'LAÇOLARIA';
  const storeInfo = cfg.companyTagline;
  const printingRef = React.useRef(false);

  React.useEffect(() => {
    const after = () => {
      if (!printingRef.current) return;
      printingRef.current = false;
      onPrintComplete?.();
    };
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, [onPrintComplete]);

  const handlePrint = () => {
    printingRef.current = true;
    window.print();
  };

  const d = new Date(data.date);
  const dateStr = d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div>
      <div
        className="receipt"
        id="receipt-print-area"
        style={{ width: cfg.receiptWidth === '58mm' ? '48mm' : '72mm' }}
      >
        <div className="center bold big">{storeName}</div>
        {storeInfo && <div className="center small">{storeInfo}</div>}
        {cfg.receiptShowCompany && cfg.companyDoc && (
          <div className="center small">{cfg.companyDoc}</div>
        )}
        {cfg.receiptShowCompany && cfg.companyAddress && (
          <div className="center small">{cfg.companyAddress}</div>
        )}
        {cfg.receiptShowCompany && cfg.companyPhone && (
          <div className="center small">Tel: {cfg.companyPhone}</div>
        )}
        <div className="sep" />
        <div className="center bold">COMPROVANTE DE COMPRA</div>
        <div className="center small">NAO E DOCUMENTO FISCAL</div>
        <div className="sep" />

        <div className="row small">
          <span>Venda:</span>
          <span>{data.saleId}</span>
        </div>
        <div className="row small">
          <span>Data:</span>
          <span>{dateStr}</span>
        </div>
        <div className="sep" />

        {data.items.map((it, i) => (
          <div key={i} className="item">
            <div className="item-name">{it.name}</div>
            <div className="row small">
              <span>
                {it.quantity} x {formatCurrency(it.unitPrice)}
              </span>
              <span>{formatCurrency(it.total)}</span>
            </div>
          </div>
        ))}

        <div className="sep" />
        <div className="row">
          <span>Subtotal</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {typeof data.interest === 'number' && data.interest > 0 && (
          <div className="row small">
            <span>Juros cartao</span>
            <span>{formatCurrency(data.interest)}</span>
          </div>
        )}
        <div className="row bold big">
          <span>TOTAL</span>
          <span>{formatCurrency(data.total)}</span>
        </div>

        <div className="sep" />
        <div className="row small">
          <span>Pagamento</span>
          <span>
            {METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod}
            {data.paymentMethod === 'cartao' && data.installments && data.installments > 1
              ? ` ${data.installments}x`
              : ''}
          </span>
        </div>
        {data.paymentMethod === 'cartao' &&
          data.installments &&
          data.installments > 1 &&
          data.installmentValue && data.installmentValue > 0 && (
            <div className="row small">
              <span>Parcela</span>
              <span>
                {data.installments}x {formatCurrency(data.installmentValue)}
              </span>
            </div>
          )}
        {data.paymentMethod === 'dinheiro' && typeof data.received === 'number' && data.received > 0 && (
          <>
            <div className="row small">
              <span>Recebido</span>
              <span>{formatCurrency(data.received)}</span>
            </div>
            <div className="row small">
              <span>Troco</span>
              <span>{formatCurrency(data.change ?? 0)}</span>
            </div>
          </>
        )}

        <div className="sep" />
        {cfg.receiptFooter
          .split('\n')
          .map((line, i) => (
            <div key={i} className="center small">
              {line}
            </div>
          ))}
        <div className="feed" />
      </div>

      <button type="button" onClick={handlePrint} className="no-print print-btn">
        Imprimir na Epson TM-T20X
      </button>

      <style jsx>{`
        .receipt {
          width: 72mm;
          margin: 0 auto;
          padding: 2mm 0;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.35;
          color: #000;
          background: #fff;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: bold;
        }
        .big {
          font-size: 14px;
        }
        .small {
          font-size: 10px;
        }
        .sep {
          border-top: 1px dashed #000;
          margin: 2mm 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          margin: 1px 0;
        }
        .item {
          margin-bottom: 2px;
          page-break-inside: avoid;
        }
        .item-name {
          font-weight: bold;
          word-break: break-word;
        }
        .feed {
          height: 8mm;
        }
        .print-btn {
          margin-top: 12px;
          width: 100%;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          background: #059669;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .print-btn:hover {
          background: #047857;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
          :global(body) {
            margin: 0;
            background: #fff;
          }
          .receipt {
            width: 72mm;
          }
        }
      `}</style>
    </div>
  );
}
