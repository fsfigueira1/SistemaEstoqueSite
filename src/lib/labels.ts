// Regras das etiquetas de gôndola (sem banco — usadas no servidor e na tela).
import { gs1CheckDigit } from './barcode';

/** Dia local "AAAA-MM-DD". */
export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Data da promoção é gravada ao meio-dia UTC: o dia não muda no fuso do Brasil. */
export function promoDayToDate(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateToPromoDay(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
}

const cents = (n: number) => Math.round(n * 100);

/**
 * Promoção vale quando o "de" é maior que o preço de venda (o "por", que é o
 * que o PDV cobra) e a data final ainda não passou (o último dia conta).
 */
export function isPromoActive(
  compareAt: number | null | undefined,
  salePrice: number,
  promoUntil: Date | string | null | undefined,
  today: string = localDay(),
): boolean {
  if (!compareAt || cents(compareAt) <= cents(salePrice)) return false;
  const until = dateToPromoDay(promoUntil);
  return !until || today <= until;
}

/** "De" que vai na etiqueta agora (0 = etiqueta normal). */
export function effectiveCompareAt(
  compareAt: number | null | undefined,
  salePrice: number,
  promoUntil: Date | string | null | undefined,
  today?: string,
): number {
  return isPromoActive(compareAt, salePrice, promoUntil, today) ? Number(compareAt) : 0;
}

export type LabelState = 'never' | 'changed' | 'ok';

/** A etiqueta na gôndola ainda bate com o preço atual? */
export function labelState(
  current: { price: number; compareAt: number },
  printed: { labelPrice: number | null; labelCompareAt: number | null; labelPrintedAt: Date | string | null } | null,
): LabelState {
  if (!printed?.labelPrintedAt || printed.labelPrice == null) return 'never';
  if (cents(printed.labelPrice) !== cents(current.price)) return 'changed';
  if (cents(printed.labelCompareAt ?? 0) !== cents(current.compareAt)) return 'changed';
  return 'ok';
}

// ---------- código de barras interno ----------
// Prefixo "20": faixa GS1 de circulação restrita (uso dentro da loja) — não
// colide com códigos de fábrica, que começam com o prefixo do país (789/790…).
const INTERNAL_PREFIX = '20';
const INTERNAL_RE = /^20\d{11}$/;

export function internalEan13(seq: number): string {
  const body = INTERNAL_PREFIX + String(seq).padStart(10, '0');
  if (body.length !== 12) throw new Error('Sequência de código interno esgotada');
  return body + gs1CheckDigit(body);
}

/** Próxima sequência livre, olhando os códigos internos que já existem. */
export function nextInternalSeq(existing: Iterable<string | null | undefined>): number {
  let max = 0;
  for (const code of existing) {
    if (code && INTERNAL_RE.test(code)) max = Math.max(max, Number(code.slice(2, 12)));
  }
  return max + 1;
}
