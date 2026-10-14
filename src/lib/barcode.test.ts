import { describe, it, expect } from 'vitest';
import { encodeBarcode as encodeOrNull, gs1CheckDigit, CODE128_PATTERNS, code128Values, barRects } from './barcode';

function encodeBarcode(code: string) {
  const b = encodeOrNull(code);
  if (!b) throw new Error(`não codificou: ${code}`);
  return b;
}

/** Converte módulos em larguras alternadas (barra, espaço, ...) sem as zonas de silêncio. */
function runs(modules: boolean[]): number[] {
  const first = modules.indexOf(true);
  const last = modules.lastIndexOf(true);
  const out: number[] = [];
  let cur = modules[first];
  let n = 0;
  for (let i = first; i <= last; i++) {
    if (modules[i] === cur) n++;
    else {
      out.push(n);
      cur = modules[i];
      n = 1;
    }
  }
  out.push(n);
  return out;
}

describe('gs1CheckDigit', () => {
  it('confere códigos conhecidos', () => {
    expect(gs1CheckDigit('400638133393')).toBe(1); // EAN-13
    expect(gs1CheckDigit('9638507')).toBe(4); // EAN-8
    expect(gs1CheckDigit('03600029145')).toBe(2); // UPC-A
    expect(gs1CheckDigit('789100031550')).toBe(7);
  });
});

describe('encodeBarcode', () => {
  it('usa EAN-13 para código de 13 dígitos válido', () => {
    const b = encodeBarcode('4006381333931');
    expect(b.format).toBe('EAN13');
    // 11 + 95 + 7 módulos
    expect(b.modules).toHaveLength(113);
    const core = b.modules.slice(11, 11 + 95).map((m) => (m ? '1' : '0')).join('');
    expect(core.startsWith('101')).toBe(true);
    expect(core.slice(45, 50)).toBe('01010');
    expect(core.endsWith('101')).toBe(true);
    // 1º dígito "4" → paridade LGLLGG; o "0" seguinte sai em L
    expect(core.slice(3, 10)).toBe('0001101');
  });

  it('usa EAN-13 para UPC-A e EAN-8 quando válidos', () => {
    expect(encodeBarcode('036000291452').format).toBe('EAN13');
    const e8 = encodeBarcode('96385074');
    expect(e8.format).toBe('EAN8');
    expect(e8.modules).toHaveLength(7 + 67 + 7);
  });

  it('cai para Code128 quando o dígito verificador não confere', () => {
    expect(encodeBarcode('4006381333930').format).toBe('CODE128');
  });

  it('cai para Code128 em SKU com letras e remove acentos', () => {
    const b = encodeBarcode('  Laço-01 ');
    expect(b.format).toBe('CODE128');
    expect(b.text).toBe('Laco-01');
  });

  it('retorna null para vazio', () => {
    expect(encodeOrNull('')).toBeNull();
    expect(encodeOrNull(null)).toBeNull();
  });

  it('Code128 decodifica de volta com checksum correto', () => {
    for (const text of ['ABC-123', '12345', '123456', 'PJJ123C']) {
      const b = encodeBarcode(text);
      const w = runs(b.modules);
      const symbols: number[] = [];
      let i = 0;
      while (i < w.length) {
        const size = w.length - i === 7 ? 7 : 6;
        const pattern = w.slice(i, i + size).join('');
        const idx = CODE128_PATTERNS.indexOf(pattern);
        expect(idx).toBeGreaterThanOrEqual(0);
        symbols.push(idx);
        i += size;
      }
      expect(symbols[symbols.length - 1]).toBe(106);
      const data = symbols.slice(0, -2);
      expect(data).toEqual(code128Values(text));
      const sum = data.reduce((acc, v, k) => acc + (k === 0 ? v : v * k), 0);
      expect(symbols[symbols.length - 2]).toBe(sum % 103);
    }
  });
});

describe('CODE128_PATTERNS', () => {
  it('tem 107 símbolos com 11 módulos (stop com 13)', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((p, i) => {
      const total = [...p].reduce((a, c) => a + Number(c), 0);
      expect(total).toBe(i === 106 ? 13 : 11);
    });
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
  });
});

describe('barRects', () => {
  it('agrupa barras consecutivas', () => {
    expect(barRects([false, true, true, false, true])).toEqual([
      { x: 1, w: 2 },
      { x: 4, w: 1 },
    ]);
  });
});
