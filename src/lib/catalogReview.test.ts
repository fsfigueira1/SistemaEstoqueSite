import { describe, expect, it } from 'vitest';
import { applyNameFixes, findDuplicates, findSpacing, findTypos, matchCase, replaceWord, tidySpaces, type ReviewProduct } from './catalogReview';
import { buildVocabulary, suggestQuery } from './smartSearch';

let n = 0;
const P = (name: string, extra: Partial<ReviewProduct> = {}): ReviewProduct => ({
  id: String(++n),
  name,
  sku: `S${n}`,
  barcode: `789${n}`,
  status: 'ACTIVE',
  stockQuantity: 1,
  salePrice: 2,
  categoryName: 'Escrita',
  ...extra,
});

const pens = ['AZUL', 'PRETA', 'VERMELHA', 'VERDE', 'ROSA'].flatMap((c) => [
  P(`CANETA SUPER GRIP PILOT 0.7MM - ${c}`),
  P(`Caneta Esferográfica Pilot BP-1 ${c}`),
]);
const catalog = [
  ...pens,
  P('CANTENA SUPER GRIP PILOT 1.0MM - PRETA'),
  P('CANETA SUPER GRIP POLOT 1.MM - AZUL'),
  P('METOO FADA MARIA'), // nome próprio: não é "marca"
  P('Marca Texto Pilot Amarelo'),
  P('Marca Texto Pilot Verde'),
  P('Marca Texto Pilot Rosa'),
  P('Marca Texto Pilot Azul'),
];

describe('findTypos', () => {
  const typos = findTypos(catalog);
  const map = Object.fromEntries(typos.map((t) => [t.wrong, t.right]));

  it('acha palavra rara quase igual a uma comum, em produtos parecidos', () => {
    expect(map.cantena).toBe('caneta');
    expect(map.polot).toBe('pilot');
  });

  it('não acusa nome próprio, plural ou cor', () => {
    expect(map.maria).toBeUndefined();
    expect(Object.keys(map)).not.toContain('preta');
  });

  it('mostra o nome corrigido mantendo maiúsculas', () => {
    const g = typos.find((t) => t.wrong === 'cantena');
    expect(g?.products[0].fixed).toBe('CANETA SUPER GRIP PILOT 1.0MM - PRETA');
  });
});

describe('correções', () => {
  it('matchCase copia o estilo da palavra', () => {
    expect(matchCase('POLOT', 'pilot')).toBe('PILOT');
    expect(matchCase('Polot', 'pilot')).toBe('Pilot');
    expect(matchCase('polot', 'Pilot')).toBe('pilot');
  });
  it('replaceWord troca só a palavra inteira', () => {
    expect(replaceWord('ESFERIOGRAFICA E ESFERIOGRAFICAS', 'esferiografica', 'esferográfica')).toBe('ESFEROGRÁFICA E ESFERIOGRAFICAS');
  });
  it('tidySpaces limpa espaços duplos e antes de pontuação', () => {
    expect(tidySpaces('  CADERNO  VERDE , 80  FOLHAS ')).toBe('CADERNO VERDE, 80 FOLHAS');
    expect(findSpacing([P('A  B'), P('A B')])).toHaveLength(1);
  });
  it('applyNameFixes junta palavras e espaços', () => {
    expect(applyNameFixes('CANTENA  POLOT', [{ wrong: 'cantena', right: 'caneta' }, { wrong: 'polot', right: 'pilot' }], true)).toBe('CANETA PILOT');
  });
});

describe('findDuplicates', () => {
  it('agrupa nomes iguais ignorando acento, caixa e pontuação', () => {
    const d = findDuplicates([P('Lápis Preto HB'), P('LAPIS PRETO - HB'), P('Lápis Azul')]);
    expect(d).toHaveLength(1);
    expect(d[0].products).toHaveLength(2);
  });
});

describe('suggestQuery ("Você quis dizer…?")', () => {
  const vocab = buildVocabulary(['Tesoura Escolar', 'Caneta Esferográfica Azul', 'Apontador com Depósito', 'Cola Branca']);
  it('corrige palavra por palavra usando a grafia do catálogo', () => {
    expect(suggestQuery('esferografca', vocab)).toBe('esferográfica');
    expect(suggestQuery('trsoura', vocab)).toBe('tesoura');
    expect(suggestQuery('cola branka', vocab)).toBe('cola branca');
  });
  it('não sugere quando já está certo ou nada é parecido', () => {
    expect(suggestQuery('tesoura', vocab)).toBeNull();
    expect(suggestQuery('xyzkkk', vocab)).toBeNull();
  });
});
