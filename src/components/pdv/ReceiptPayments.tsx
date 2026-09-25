'use client';

// Linhas de pagamento do comprovante: uma forma, ou várias (pagamento dividido).

import React from 'react';
import { PAY_RECEIPT } from '@/lib/payments';
import type { ReceiptData } from '@/components/pdv/ReceiptPrint';

const METHOD_LABEL: Record<string, string> = {
  dinheiro: 'DINHEIRO',
  pix: 'PIX',
  cartao: 'CARTAO CREDITO',
};

export function ReceiptPayments({ data, brl }: { data: ReceiptData; brl: (v: unknown) => string }) {
  const formatCurrency = brl;
  return (
    <>
      {data.payments && data.payments.length > 0 ? (
        <>
          {data.payments.map((p, i) => (
            <React.Fragment key={i}>
              <div className="row small">
                <span>
                  {PAY_RECEIPT[p.method] ?? p.method}
                  {p.installments && p.installments > 1 ? ` ${p.installments}x` : ''}
                </span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
              {p.installments && p.installments > 1 && p.installmentValue ? (
                <div className="row small">
                  <span>Parcela</span>
                  <span>
                    {p.installments}x {formatCurrency(p.installmentValue)}
                  </span>
                </div>
              ) : null}
            </React.Fragment>
          ))}
          {data.payments.some((p) => p.method === 'CASH') && typeof data.received === 'number' && data.received > 0 && (
            <>
              <div className="row small">
                <span>Recebido dinheiro</span>
                <span>{formatCurrency(data.received)}</span>
              </div>
              <div className="row small">
                <span>Troco</span>
                <span>{formatCurrency(data.change ?? 0)}</span>
              </div>
            </>
          )}
        </>
      ) : (
        <>
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
            data.installmentValue &&
            data.installmentValue > 0 && (
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
        </>
      )}
    </>
  );
}
