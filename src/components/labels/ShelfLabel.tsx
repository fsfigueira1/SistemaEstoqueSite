'use client';

import React from 'react';
import { encodeBarcode, barRects } from '@/lib/barcode';

// Etiqueta de gôndola — tamanho fixo 6,5cm x 3cm. Tudo em mm/pt para sair
// no tamanho real na impressão (a tela é só aproximação).
export const LABEL_W_MM = 65;
export const LABEL_H_MM = 30;

export interface ShelfLabelData {
  name: string;
  /** Preço de venda — o "por" da promoção, que é o que o PDV cobra. */
  price: number;
  /** Código impresso nas barras (código de barras do produto, ou o SKU). */
  code: string;
  category?: string | null;
  unit?: string | null;
  /** "De R$ X" da promoção ativa (0/ausente = etiqueta normal). */
  compareAt?: number;
  /** Último dia da promoção, "AAAA-MM-DD". */
  promoUntil?: string | null;
}

const BARCODE_MAX_W_MM = LABEL_W_MM - 4;
const BARCODE_H_MM = 7;
// Largura nominal do módulo do EAN-13 (100%) é 0,33mm.
const MODULE_MM = 0.33;
// Categoria "coringa" não vai para a gôndola.
const HIDDEN_CATEGORIES = new Set(['sem categoria', 'geral', 'outros']);

function splitPrice(value: number): { int: string; cents: string } {
  const fixed = (Number.isFinite(value) ? value : 0).toFixed(2);
  const [i, c] = fixed.split('.');
  return { int: new Intl.NumberFormat('pt-BR').format(Number(i)), cents: c };
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function unitLabel(unit?: string | null): string {
  const u = (unit ?? '').trim().toLowerCase();
  if (!u || u === 'unidade' || u === 'un') return 'un.';
  return u;
}

/** Nome longo diminui a letra e ganha uma 3ª linha em vez de ser cortado. */
function nameStyle(length: number): { fontSize: string; lines: number } {
  if (length <= 62) return { fontSize: '7.5pt', lines: 2 };
  if (length <= 95) return { fontSize: '6.3pt', lines: 3 };
  return { fontSize: '5.6pt', lines: 3 };
}

function shortDay(day?: string | null): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

export function BarcodeSvg({ code }: { code: string }) {
  const bc = React.useMemo(() => {
    try {
      return encodeBarcode(code);
    } catch {
      return null;
    }
  }, [code]);
  if (!bc) return null;

  const total = bc.modules.length;
  const widthMm = Math.min(BARCODE_MAX_W_MM, total * MODULE_MM);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg
        width={`${widthMm}mm`}
        height={`${BARCODE_H_MM}mm`}
        viewBox={`0 0 ${total} 100`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-label={`Código de barras ${bc.text}`}
        style={{ display: 'block' }}
      >
        {barRects(bc.modules).map((r) => (
          <rect key={r.x} x={r.x} y={0} width={r.w} height={100} fill="#000" />
        ))}
      </svg>
      <div
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '6.5pt',
          lineHeight: 1,
          letterSpacing: '0.3mm',
          marginTop: '0.4mm',
          color: '#000',
        }}
      >
        {bc.text}
      </div>
    </div>
  );
}

function BigPrice({ value }: { value: number }) {
  const price = splitPrice(value);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: '8pt', fontWeight: 700, marginRight: '0.8mm', marginTop: '0.6mm' }}>R$</span>
      <span style={{ fontSize: '21pt', fontWeight: 800, letterSpacing: '-0.02em' }}>{price.int}</span>
      <span style={{ fontSize: '11pt', fontWeight: 800, marginTop: '0.4mm' }}>,{price.cents}</span>
    </div>
  );
}

/** Lado esquerdo da linha do preço: categoria/unidade, ou o "de" da promoção. */
function PriceSide({ data, promo }: { data: ShelfLabelData; promo: boolean }) {
  const until = shortDay(data.promoUntil);
  if (promo) {
    return (
      <div style={{ minWidth: 0, flex: '1 1 auto', lineHeight: 1.15 }}>
        <div
          style={{
            display: 'inline-block',
            // contorno (não fundo preto): a impressão força todo texto para preto
            border: '0.3mm solid #000',
            color: '#000',
            fontSize: '6pt',
            fontWeight: 800,
            padding: '0.3mm 1.2mm',
            borderRadius: '0.6mm',
            letterSpacing: '0.04em',
          }}
        >
          OFERTA
        </div>
        <div style={{ fontSize: '7pt', fontWeight: 700, marginTop: '0.5mm', whiteSpace: 'nowrap' }}>
          DE <span style={{ textDecoration: 'line-through' }}>{brl(Number(data.compareAt))}</span>
        </div>
        {until && <div style={{ fontSize: '5.5pt' }}>até {until}</div>}
      </div>
    );
  }
  const category = data.category && !HIDDEN_CATEGORIES.has(data.category.trim().toLowerCase()) ? data.category : null;
  return (
    <div style={{ fontSize: '5.5pt', lineHeight: 1.2, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
      {category && <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{category}</div>}
      <div>{unitLabel(data.unit)}</div>
    </div>
  );
}

export function ShelfLabel({ data, cutLines = true }: { data: ShelfLabelData; cutLines?: boolean }) {
  const promo = Boolean(data.compareAt && data.compareAt > data.price);
  const name = nameStyle(data.name.length);
  return (
    <div
      style={{
        width: `${LABEL_W_MM}mm`,
        height: `${LABEL_H_MM}mm`,
        boxSizing: 'border-box',
        padding: '1.5mm 2mm 1.2mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        // outline (não border) para não roubar espaço da etiqueta; com o
        // offset negativo as linhas de etiquetas vizinhas caem no mesmo lugar.
        outline: cutLines ? '0.15mm solid #9a9a9a' : 'none',
        outlineOffset: '-0.075mm',
        breakInside: 'avoid',
      }}
    >
      <div
        style={{
          fontSize: name.fontSize,
          fontWeight: 700,
          lineHeight: 1.12,
          maxHeight: `${name.lines * 1.12}em`,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: name.lines,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
          textTransform: 'uppercase',
        }}
      >
        {data.name}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '2mm' }}>
        <PriceSide data={data} promo={promo} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.8mm' }}>
          {promo && <span style={{ fontSize: '7pt', fontWeight: 800, marginBottom: '0.8mm' }}>POR</span>}
          <BigPrice value={data.price} />
        </div>
      </div>

      <BarcodeSvg code={data.code} />
    </div>
  );
}
