'use client';

import React from 'react';

// Local formatCurrency to avoid circular import
function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(
    typeof value === 'number' ? value :
    typeof value === 'string' ? parseFloat(value.replace(',', '.')) || 0 :
    value && typeof value === 'object' && 'toNumber' in value ? (value as { toNumber: () => number }).toNumber() : 0
  );
}

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptData {
  saleId: string;
  date: Date | string;
  items: ReceiptItem[];
  subtotal: number;
  paymentMethod: 'dinheiro' | 'pix' | 'cartao';
  interest: number;
  total: number;
  installments?: number;
  installmentValue?: number;
}

interface ReceiptPrintProps {
  data: ReceiptData;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  onPrintComplete?: () => void;
}

export function ReceiptPrint({
  data,
  storeName = 'Laçolaria',
  storeAddress,
  storePhone,
  onPrintComplete,
}: ReceiptPrintProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const paymentMethodLabels: Record<string, string> = {
    dinheiro: 'DINHEIRO',
    pix: 'PIX',
    cartao: 'CARTÃO',
  };

  const handlePrint = () => {
    // Prevent double printing
    if (printedRef.current) return;
    printedRef.current = true;
    window.print();
    // onPrintComplete is called via afterprint event listener
  };

  // Auto-print when component mounts (for print dialog)
  // We use a ref to track if we've already printed
  const printedRef = React.useRef(false);

  React.useEffect(() => {
    // Reset printedRef when data changes to allow re-printing
    printedRef.current = false;

    // Auto-print when component mounts and data is available
    if (!printedRef.current && data) {
      printedRef.current = true;
      // Use requestAnimationFrame for better timing
      const handleAutoPrint = () => {
        window.print();
      };
      
      if (document.readyState === 'complete') {
        requestAnimationFrame(handleAutoPrint);
      } else {
        const timer = setTimeout(handleAutoPrint, 100);
        return () => clearTimeout(timer);
      }
    }

    // Handle print completion - stable callback
    const handleAfterPrint = () => {
      onPrintComplete?.();
      printedRef.current = false; // Reset to allow future prints
      window.removeEventListener('afterprint', handleAfterPrint);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [data, onPrintComplete]); // Added data to dependency array

  return (
    <div className="receipt-print">
      <div className="receipt-header">
        <h1 className="store-name">{storeName}</h1>
        {storeAddress && <p className="store-address">{storeAddress}</p>}
        {storePhone && <p className="store-phone">{storePhone}</p>}
        <hr className="divider" />
        <h2 className="receipt-title">COMPROVANTE DE VENDA</h2>
      </div>

      <div className="receipt-info">
        <div className="info-row">
          <span className="label">Venda:</span>
          <span className="value">{data.saleId}</span>
        </div>
        <div className="info-row">
          <span className="label">Data:</span>
          <span className="value">{formatDate(data.date)}</span>
        </div>
      </div>

      <hr className="divider" />

      <div className="receipt-items">
        {data.items.map((item, index) => (
          <div key={index} className="item-row">
            <div className="item-name">{item.name}</div>
            <div className="item-details">
              <span className="qty-price">{item.quantity} x {formatCurrency(item.unitPrice)}</span>
              <span className="item-total">{formatCurrency(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <hr className="divider" />

      <div className="receipt-totals">
        <div className="total-row">
          <span className="label">Subtotal:</span>
          <span className="value">{formatCurrency(data.subtotal)}</span>
        </div>

        {data.paymentMethod === 'cartao' && data.interest > 0 && (
          <div className="total-row interest">
            <span className="label">Juros (3.5%):</span>
            <span className="value">{formatCurrency(data.interest)}</span>
          </div>
        )}

        {data.paymentMethod === 'cartao' && data.installments && data.installments > 1 && (
          <div className="installments">
            <div className="total-row">
              <span className="label">Parcelamento:</span>
              <span className="value">{data.installments}x de {formatCurrency(data.installmentValue || data.total / data.installments)}</span>
            </div>
          </div>
        )}

        <div className="total-row payment-method">
          <span className="label">Pagamento:</span>
          <span className="value">{paymentMethodLabels[data.paymentMethod]}</span>
        </div>

        <hr className="divider thick" />

        <div className="total-row grand-total">
          <span className="label">TOTAL:</span>
          <span className="value">{formatCurrency(data.total)}</span>
        </div>
      </div>

      <hr className="divider" />

      <div className="receipt-footer">
        <p className="non-fiscal-notice">
          Comprovante não fiscal — apenas para controle interno/cliente
        </p>
      </div>

      {/* Print button for manual trigger (visible only on screen, not print) */}
      <div className="print-actions no-print">
        <button onClick={handlePrint} className="print-btn">
          Imprimir Comprovante
        </button>
      </div>

      <style jsx>{`
        .receipt-print {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 4mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          background: #fff;
        }

        .receipt-header {
          text-align: center;
          margin-bottom: 4mm;
        }

        .store-name {
          font-size: 16px;
          font-weight: bold;
          margin: 0 0 2px 0;
          letter-spacing: 1px;
        }

        .store-address,
        .store-phone {
          font-size: 10px;
          margin: 1px 0;
          color: #333;
        }

        .receipt-title {
          font-size: 12px;
          font-weight: bold;
          margin: 4px 0;
          text-transform: uppercase;
        }

        .divider {
          border: none;
          border-top: 1px dashed #000;
          margin: 3mm 0;
        }

        .divider.thick {
          border-top: 2px solid #000;
        }

        .receipt-info {
          margin-bottom: 3mm;
          font-size: 11px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }

        .label {
          font-weight: normal;
        }

        .value {
          font-weight: bold;
          text-align: right;
        }

        .receipt-items {
          margin-bottom: 3mm;
        }

        .item-row {
          margin-bottom: 3px;
          page-break-inside: avoid;
        }

        .item-name {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 1px;
          word-wrap: break-word;
        }

        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }

        .qty-price {
          color: #333;
        }

        .item-total {
          font-weight: bold;
          white-space: nowrap;
        }

        .receipt-totals {
          font-size: 11px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }

        .total-row.interest {
          color: #c00;
        }

        .total-row.payment-method {
          margin-top: 4px;
          font-weight: bold;
        }

        .installments {
          margin: 4px 0;
          padding-left: 2mm;
        }

        .grand-total {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
        }

        .grand-total .value {
          font-size: 16px;
        }

        .receipt-footer {
          text-align: center;
          margin-top: 4mm;
          padding-top: 2mm;
        }

        .non-fiscal-notice {
          font-size: 9px;
          font-style: italic;
          color: #666;
          margin: 0;
          line-height: 1.5;
        }

        .print-actions {
          text-align: center;
          margin-top: 4mm;
          padding-top: 2mm;
        }

        .print-btn {
          background: #059669;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
        }

        .print-btn:hover {
          background: #047857;
        }

        .no-print {
          display: block;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }

          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }

          .receipt-print {
            width: 80mm;
            max-width: 80mm;
          }
        }
      `}</style>
    </div>
  );
}