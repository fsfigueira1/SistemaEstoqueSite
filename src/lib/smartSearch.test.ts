import { describe, expect, it } from 'vitest';
import { editDistance, productSearchFields, smartSearch, stem, tokenize } from './smartSearch';

const P = (name: string, extra: Partial<{ sku: string; barcode: string; categoryName: string }> = {}) => ({
  name,
  sku: extra.sku ?? name.slice(0, 4),
  barcode: extra.barcode ?? null,
  categoryName: extra.categoryName ?? 'Escolar',
});

const catalog = [
  P('CADERNO 10 MATÉRIAS TILIBRA BATMAN', { categoryName: 'Cadernos' }),
  P('Caderno Foroni Batman 1 matéria', { categoryName: 'Cadernos' }),
  P('BATMAN FORONI 10x1 – 160 FOLHAS'),
  P('Caderno Brochura Pepper Preto', { categoryName: 'Cadernos' }),
  P('CANETA BIC 1.0 - PRETA', { categoryName: 'Escrita' }),
  P('Caneta Esferográfica Lid 1.0mm Tilibra – Preta', { categoryName: 'Escrita' }),
  P('CANETA BIC 1.0 - AZUL', { categoryName: 'Escrita' }),
  P('Lápis Grafite Preto HB', { sku: '0010', barcode: '7891234567895' }),
  P('Mochila Batman Infantil'),
];
const names = (q: string) => smartSearch(catalog, q, productSearchFields).map((p) => p.name);

describe('smartSearch', () => {
  it('acha as palavras em qualquer ordem, de qualquer marca', () => {
    const r = names('caderno batman');
    expect(r.slice(0, 2)).toEqual(expect.arrayContaining(['CADERNO 10 MATÉRIAS TILIBRA BATMAN', 'Caderno Foroni Batman 1 matéria']));
    expect(names('batman caderno').slice(0, 2)).toEqual(r.slice(0, 2));
  });

  it('completa com o produto sem a palavra comum no nome (só depois dos exatos)', () => {
    const r = names('caderno batman');
    expect(r).toContain('BATMAN FORONI 10x1 – 160 FOLHAS');
    expect(r.indexOf('BATMAN FORONI 10x1 – 160 FOLHAS')).toBeGreaterThan(1);
  });

  it('ignora plural, gênero e acento', () => {
    const r = names('canetas pretas');
    expect(r).toEqual(expect.arrayContaining(['CANETA BIC 1.0 - PRETA', 'Caneta Esferográfica Lid 1.0mm Tilibra – Preta']));
    expect(r).not.toContain('CANETA BIC 1.0 - AZUL');
    expect(names('lapis')).toEqual(['Lápis Grafite Preto HB']);
  });

  it('aceita erro de digitação e palavra pela metade', () => {
    expect(names('cadreno pepper')).toEqual(['Caderno Brochura Pepper Preto']);
    expect(names('canta bic azul')).toEqual(['CANETA BIC 1.0 - AZUL']);
    expect(names('moch')).toEqual(['Mochila Batman Infantil']);
  });

  it('acha por SKU, código de barras e categoria', () => {
    expect(names('0010')).toEqual(['Lápis Grafite Preto HB']);
    expect(names('4567895')).toEqual(['Lápis Grafite Preto HB']);
    expect(names('escrita azul')).toEqual(['CANETA BIC 1.0 - AZUL']);
  });

  it('busca vazia devolve tudo; palavra inexistente não devolve nada', () => {
    expect(names('  ')).toHaveLength(catalog.length);
    expect(names('xyzwq')).toEqual([]);
  });
});

describe('helpers', () => {
  it('stem junta singular/plural e masculino/feminino', () => {
    expect(stem('pretas')).toBe(stem('preto'));
    expect(stem('cadernos')).toBe(stem('caderno'));
    expect(stem('cores')).toBe('cor');
  });
  it('tokenize separa número de unidade', () => {
    expect(tokenize('0,7mm Lápis')).toEqual(['0', '7', 'mm', 'lapis']);
  });
  it('editDistance conta troca de letras vizinhas como 1 erro', () => {
    expect(editDistance('cadreno', 'caderno', 2)).toBe(1);
    expect(editDistance('abc', 'xyz', 1)).toBe(2);
  });
});
