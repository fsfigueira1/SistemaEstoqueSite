import { describe, it, expect } from 'vitest'
import { slugify, newListCode, LIST_CODE_ALPHABET, normalizeGrade, toSaveItems, savedLines, defaultSchoolYear } from './savedLists'

describe('defaultSchoolYear', () => {
  it('até junho é o ano corrente; de julho em diante, o seguinte', () => {
    expect(defaultSchoolYear(new Date(2026, 5, 30))).toBe(2026)
    expect(defaultSchoolYear(new Date(2026, 6, 1))).toBe(2027)
    expect(defaultSchoolYear(new Date(2026, 0, 2))).toBe(2026)
  })
})

describe('slugify', () => {
  it('remove acento, caixa e espaços extras', () => {
    expect(slugify('Colégio São José')).toBe('colegio-sao-jose')
    expect(slugify('  colegio   sao jose ')).toBe('colegio-sao-jose')
    expect(slugify('E.E. Prof. Ana (Unidade 2)')).toBe('e-e-prof-ana-unidade-2')
  })
})

describe('newListCode', () => {
  it('formato L- + 4 do alfabeto seguro', () => {
    for (let i = 0; i < 50; i++) expect(newListCode()).toMatch(/^L-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
  })
  it('determinístico com rand fixo', () => {
    expect(newListCode(() => 0)).toBe(`L-${LIST_CODE_ALPHABET[0].repeat(4)}`)
  })
})

describe('normalizeGrade', () => {
  it('colapsa espaços', () => expect(normalizeGrade('  3º   ano ')).toBe('3º ano'))
})

describe('toSaveItems', () => {
  it('ignora linhas fora e guarda só o id do produto', () => {
    const rows = [
      { raw: '2 lápis', text: 'lápis', qty: 2, skip: false, product: { id: 'p1' } },
      { raw: '1 régua', text: 'régua', qty: 1, skip: true, product: { id: 'p2' } },
      { raw: '1 compasso', text: 'compasso', qty: 1, skip: false, product: null },
    ]
    expect(toSaveItems(rows)).toEqual([
      { raw: '2 lápis', text: 'lápis', qty: 2, productId: 'p1' },
      { raw: '1 compasso', text: 'compasso', qty: 1, productId: null },
    ])
  })
})

describe('savedLines', () => {
  it('liga ao catálogo atual; produto ausente vira null', () => {
    const p1 = { id: 'p1', name: 'Lápis HB', barcode: null, sku: 'L1', salePrice: 2.5, stock: 10 }
    const lines = savedLines(
      [
        { raw: '2 lápis', text: 'lápis', qty: 2, productId: 'p1' },
        { raw: '1 cola', text: 'cola', qty: 1, productId: 'sumiu' },
        { raw: '1 compasso', text: 'compasso', qty: 1, productId: null },
      ],
      new Map([['p1', p1]]),
    )
    expect(lines.map((l) => l.product?.id ?? null)).toEqual(['p1', null, null])
  })
})
