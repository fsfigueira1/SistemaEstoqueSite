import { describe, it, expect } from 'vitest'
import { slugify, newListCode, LIST_CODE_ALPHABET, normalizeGrade, toSaveItems, savedLines, defaultSchoolYear, gradeKey, gradeTag, pickList } from './savedLists'

describe('gradeTag', () => {
  it.each([
    ['3º ano', 'a3'], ['3o ano', 'a3'], ['3° Ano', 'a3'], ['3 ano', 'a3'], ['terceiro ano', 'a3'], ['3º ano do fundamental', 'a3'],
    ['Infantil 4', 'i4'], ['infantil4', 'i4'], ['4 anos', 'i4'], ['infantil 4a', 'i4'], ['infantil 4 anos', 'i4'],
    ['1ª série do médio', 'ma1'], ['1º ano do ensino médio', 'ma1'],
  ])('%s → %s', (asked, tag) => expect(gradeTag(asked)).toBe(tag))

  it('sem série clara devolve null', () => {
    expect(gradeTag('3')).toBeNull()
    expect(gradeTag('a do meu filho')).toBeNull()
  })
})

describe('pickList', () => {
  const sj = { schoolName: 'Colégio São José Agostiniano' }
  const lists = [
    { ...sj, grade: '3º ano', schoolYear: 2026, id: 'old' },
    { ...sj, grade: '3º ano', schoolYear: 2027, id: 'new' },
    { ...sj, grade: 'Infantil 3', schoolYear: 2027, id: 'inf' },
    { schoolName: 'Escola Modelo', grade: '5º ano', schoolYear: 2027, id: 'm5' },
    { ...sj, grade: '5º ano', schoolYear: 2027, id: 's5' },
  ]
  const id = (r: ReturnType<typeof pickList<{ id: string }>>) => (r.status === 'found' ? r.list.id : r.status)

  it('acha a do ano letivo mais novo', () => expect(id(pickList(lists, 'terceiro ano'))).toBe('new'))
  it('"3 anos" é o Infantil 3, não o 3º ano', () => expect(id(pickList(lists, '3 anos'))).toBe('inf'))
  it.each(['são josé', 'Colégio São José', 'agostiniano', 'CSJ'])('escola "%s"', (s) => expect(id(pickList(lists, '5º ano', s))).toBe('s5'))
  it('duas escolas com a série e nenhuma citada: pergunta', () => expect(pickList(lists, '5º ano').status).toBe('many_schools'))
  it('escola sem lista', () => expect(pickList(lists, '3º ano', 'Objetivo').status).toBe('no_school'))
  it('médio não pega o fundamental', () => expect(pickList(lists, '3º ano do médio').status).toBe('no_grade'))
  it('série não entendida devolve as que existem', () => {
    const r = pickList(lists, 'a do meu filho', 'são josé')
    expect(r).toEqual({ status: 'no_grade', grades: ['3º ano', 'Infantil 3', '5º ano'] })
  })
})

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

describe('gradeKey', () => {
  it('mesma série com caixa, acento e sinal de ordinal diferentes', () => {
    const k = gradeKey('3º ano')
    expect(gradeKey('3º Ano')).toBe(k)
    expect(gradeKey('3o ano')).toBe(k)
    expect(gradeKey('3° ANO ')).toBe(k)
    expect(gradeKey('4º ano')).not.toBe(k)
  })
})

describe('toSaveItems mantém produto salvo', () => {
  it('linha reaberta com produto inativo continua ligada ao produto salvo', () => {
    const rows = [{ raw: '1 cola', text: 'cola', qty: 1, skip: false, product: null, savedProductId: 'p9' }]
    expect(toSaveItems(rows)[0].productId).toBe('p9')
  })
  it('produto escolhido na tela vence o salvo', () => {
    const rows = [{ raw: '1 cola', text: 'cola', qty: 1, skip: false, product: { id: 'p1' }, savedProductId: 'p9' }]
    expect(toSaveItems(rows)[0].productId).toBe('p1')
  })
})

describe('savedLines devolve o produto salvo', () => {
  it('savedProductId vem mesmo quando o produto está fora do catálogo', () => {
    const lines = savedLines([{ raw: '1 cola', text: 'cola', qty: 1, productId: 'p9' }], new Map())
    expect(lines[0]).toMatchObject({ product: null, savedProductId: 'p9' })
  })
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
