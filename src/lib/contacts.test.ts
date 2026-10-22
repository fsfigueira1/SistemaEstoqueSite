import { describe, it, expect } from 'vitest'
import { OPT_OUT_FOOTER, buildVcf, parseContacts, personalize, waLink, withFooter } from './contacts'

describe('parseContacts', () => {
  it('parseContacts aceita os formatos do Excel', () => {
    expect(parseContacts('Nome\tTelefone\nAna Souza\t(17) 99999-8888\nBeto\t17 3228-0909').rows).toEqual([
      { name: 'Ana Souza', phone: '5517999998888' },
      { name: 'Beto', phone: '551732280909' },
    ])
    expect(parseContacts('celular;cliente\n+55 17 99999-8888;Ana').rows).toEqual([{ name: 'Ana', phone: '5517999998888' }])
    expect(parseContacts('Ana,17999998888\nBeto,17988887777').rows.map((r) => r.phone)).toEqual(['5517999998888', '5517988887777'])
  })

  it('aponta inválidos e tira repetidos', () => {
    const r = parseContacts('Ana\t123\nAna\t17999998888\nRepetida\t(17)99999-8888')
    expect(r.rows).toEqual([{ name: 'Ana', phone: '5517999998888' }])
    expect(r.invalid).toEqual([{ line: 1, raw: 'Ana\t123' }])
  })

  it('só telefones, sem nome', () => {
    expect(parseContacts('17999998888\n(17) 98888-7777').rows).toEqual([
      { name: '', phone: '5517999998888' },
      { name: '', phone: '5517988887777' },
    ])
  })
})

describe('mensagem', () => {
  it('personalize com e sem nome', () => {
    expect(personalize('Olá, {nome}! Chegou caderno.', 'ANA souza')).toBe('Olá, Ana! Chegou caderno.')
    expect(personalize('Olá, {nome}! Chegou caderno.', null)).toBe('Olá! Chegou caderno.')
    expect(personalize('{nome}, chegou caderno', '')).toBe('Chegou caderno')
    expect(personalize('Sem nome aqui', 'Ana')).toBe('Sem nome aqui')
  })

  it('withFooter não duplica', () => {
    expect(withFooter('Oi')).toBe('Oi\n\n' + OPT_OUT_FOOTER)
    expect(withFooter(withFooter('Oi'))).toBe('Oi\n\n' + OPT_OUT_FOOTER)
  })

  it('waLink e buildVcf', () => {
    expect(waLink('5517999998888', 'Oi & tchau')).toBe('https://wa.me/5517999998888?text=Oi%20%26%20tchau')
    const v = buildVcf([
      { name: 'Ana; Souza', phone: '5517999998888' },
      { name: null, phone: '551732280909' },
    ])
    expect(v).toContain('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana\\; Souza\r\nTEL;TYPE=CELL:+5517999998888\r\nEND:VCARD')
    expect(v).toContain('FN:Cliente 0909')
  })
})
