// Gerador de código de barras sem dependências — devolve a sequência de
// módulos (true = barra, false = espaço) já com as zonas de silêncio, pronta
// para virar <rect>s num SVG.
//
// - EAN-13 / UPC-A (12 dígitos) / EAN-8: quando o código é numérico, tem o
//   tamanho certo e o dígito verificador confere — é o padrão dos produtos de
//   mercado e o que o leitor do PDV espera.
// - Code128: qualquer outro código (SKU interno, código com letras, numérico
//   sem dígito verificador válido). Numéricos usam o subconjunto C (2 dígitos
//   por símbolo) pra caber na etiqueta de 6,5cm.

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'CODE128';

export interface Barcode {
  format: BarcodeFormat;
  /** Texto legível impresso abaixo das barras. */
  text: string;
  /** Módulos da esquerda pra direita, incluindo as zonas de silêncio. */
  modules: boolean[];
}

// ---------- EAN ----------
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
const EAN_G = EAN_R.map((p) => [...p].reverse().join(''));
// Paridade (L/G) dos 6 dígitos da esquerda, definida pelo 1º dígito do EAN-13.
const EAN13_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Dígito verificador GS1 (EAN-8, EAN-13, UPC-A) para os dígitos sem o verificador. */
export function gs1CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // pesos alternados 3,1 contando a partir da direita
    const weight = (digits.length - i) % 2 === 1 ? 3 : 1;
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function isValidGs1(code: string): boolean {
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

function bits(s: string): boolean[] {
  return [...s].map((c) => c === '1');
}

function quiet(n: number): boolean[] {
  return new Array<boolean>(n).fill(false);
}

function encodeEan13(code: string): boolean[] {
  const parity = EAN13_PARITY[Number(code[0])];
  let s = '101';
  for (let i = 1; i <= 6; i++) {
    const d = Number(code[i]);
    s += parity[i - 1] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  s += '01010';
  for (let i = 7; i <= 12; i++) s += EAN_R[Number(code[i])];
  s += '101';
  return [...quiet(11), ...bits(s), ...quiet(7)];
}

function encodeEan8(code: string): boolean[] {
  let s = '101';
  for (let i = 0; i < 4; i++) s += EAN_L[Number(code[i])];
  s += '01010';
  for (let i = 4; i < 8; i++) s += EAN_R[Number(code[i])];
  s += '101';
  return [...quiet(7), ...bits(s), ...quiet(7)];
}

// ---------- Code128 ----------
// Larguras (barra, espaço, barra, ...) de cada símbolo 0..105; 106 = stop.
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const C128_START_B = 104;
const C128_START_C = 105;
const C128_CODE_B = 100;
const C128_STOP = 106;

/** Valores de símbolo do Code128 (sem checksum/stop) para o texto. */
export function code128Values(text: string): number[] {
  const numeric = /^\d+$/.test(text);
  if (numeric && text.length >= 4) {
    // Subconjunto C: pares de dígitos. Sobrando um dígito, troca pra B no fim.
    const values = [C128_START_C];
    const even = text.length - (text.length % 2);
    for (let i = 0; i < even; i += 2) values.push(Number(text.slice(i, i + 2)));
    if (even < text.length) values.push(C128_CODE_B, text.charCodeAt(even) - 32);
    return values;
  }
  const values = [C128_START_B];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 127) throw new Error(`Caractere não suportado no código de barras: "${ch}"`);
    values.push(c - 32);
  }
  return values;
}

function encodeCode128(text: string): boolean[] {
  const values = code128Values(text);
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103, C128_STOP);

  const out: boolean[] = [...quiet(10)];
  for (const v of values) {
    const widths = CODE128_PATTERNS[v];
    for (let i = 0; i < widths.length; i++) {
      const bar = i % 2 === 0;
      for (let w = 0; w < Number(widths[i]); w++) out.push(bar);
    }
  }
  out.push(...quiet(10));
  return out;
}

/** Remove acentos e qualquer coisa fora do ASCII imprimível (Code128 B). */
function toAscii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '');
}

/**
 * Escolhe o melhor formato para o código e codifica.
 * Devolve null quando não há nada codificável.
 */
export function encodeBarcode(raw: string | null | undefined): Barcode | null {
  const code = toAscii(String(raw ?? '').trim());
  if (!code) return null;

  if (/^\d+$/.test(code)) {
    if (code.length === 13 && isValidGs1(code)) {
      return { format: 'EAN13', text: code, modules: encodeEan13(code) };
    }
    if (code.length === 12 && isValidGs1(code)) {
      // UPC-A é um EAN-13 com 0 na frente
      return { format: 'EAN13', text: code, modules: encodeEan13('0' + code) };
    }
    if (code.length === 8 && isValidGs1(code)) {
      return { format: 'EAN8', text: code, modules: encodeEan8(code) };
    }
  }
  return { format: 'CODE128', text: code, modules: encodeCode128(code) };
}

/** Agrupa módulos consecutivos de barra em retângulos {x, w} (em módulos). */
export function barRects(modules: boolean[]): { x: number; w: number }[] {
  const rects: { x: number; w: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (!modules[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < modules.length && modules[i]) i++;
    rects.push({ x: start, w: i - start });
  }
  return rects;
}
