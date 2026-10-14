import { describe, it, expect } from 'vitest';
import {
  dateToPromoDay,
  effectiveCompareAt,
  internalEan13,
  isPromoActive,
  labelState,
  nextInternalSeq,
  promoDayToDate,
} from './labels';
import { encodeBarcode } from './barcode';

describe('promoção', () => {
  it('vale com "de" maior que o preço e sem data', () => {
    expect(isPromoActive(19.9, 14.9, null, '2026-10-14')).toBe(true);
  });
  it('não vale com "de" igual ou menor que o preço', () => {
    expect(isPromoActive(14.9, 14.9, null)).toBe(false);
    expect(isPromoActive(10, 14.9, null)).toBe(false);
    expect(isPromoActive(null, 14.9, null)).toBe(false);
  });
  it('vale até o último dia, inclusive', () => {
    const until = promoDayToDate('2026-10-20');
    expect(isPromoActive(20, 15, until, '2026-10-20')).toBe(true);
    expect(isPromoActive(20, 15, until, '2026-10-21')).toBe(false);
    expect(effectiveCompareAt(20, 15, until, '2026-10-21')).toBe(0);
  });
  it('data guardada não muda de dia', () => {
    expect(dateToPromoDay(promoDayToDate('2026-12-31'))).toBe('2026-12-31');
    expect(promoDayToDate('31/12/2026')).toBeNull();
  });
});

describe('labelState', () => {
  const printedAt = new Date('2026-10-01');
  it('nunca impressa', () => {
    expect(labelState({ price: 10, compareAt: 0 }, null)).toBe('never');
  });
  it('preço igual = ok, preço novo = mudou', () => {
    const printed = { labelPrice: 10, labelCompareAt: 0, labelPrintedAt: printedAt };
    expect(labelState({ price: 10, compareAt: 0 }, printed)).toBe('ok');
    expect(labelState({ price: 10.5, compareAt: 0 }, printed)).toBe('changed');
  });
  it('promoção que começou ou acabou = mudou', () => {
    const printed = { labelPrice: 10, labelCompareAt: 12, labelPrintedAt: printedAt };
    expect(labelState({ price: 10, compareAt: 0 }, printed)).toBe('changed');
    expect(labelState({ price: 10, compareAt: 12 }, printed)).toBe('ok');
  });
});

describe('código interno', () => {
  it('gera EAN-13 válido com prefixo 20', () => {
    const code = internalEan13(1);
    expect(code).toBe('2000000000015');
    expect(encodeBarcode(code)?.format).toBe('EAN13');
  });
  it('continua da maior sequência existente e ignora códigos de fábrica', () => {
    expect(nextInternalSeq(['7891000315507', null, '2000000000015', internalEan13(41)])).toBe(42);
    expect(nextInternalSeq([])).toBe(1);
  });
});
