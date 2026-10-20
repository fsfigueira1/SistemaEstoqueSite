import { describe, it, expect } from 'vitest'
import { isJsonRequest } from './requireJson'

describe('isJsonRequest', () => {
  it('aceita só application/json pelo tipo principal', () => {
    const r = (ct: string) => new Request('http://x', { method: 'POST', headers: { 'content-type': ct } })
    expect(isJsonRequest(r('application/json; charset=utf-8'))).toBe(true)
    expect(isJsonRequest(r('text/plain; charset=application/json'))).toBe(false)
    expect(isJsonRequest(r('multipart/form-data'))).toBe(false)
  })
})
