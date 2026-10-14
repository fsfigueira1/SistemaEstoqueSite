import { describe, it, expect } from 'vitest';
import { assertTestDatabase } from './dbGuard';

describe('assertTestDatabase', () => {
  it('bloqueia o Supabase da loja', () => {
    expect(() =>
      assertTestDatabase('postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'),
    ).toThrow(/BLOQUEADO/);
  });
  it('libera banco local e sem banco', () => {
    expect(() => assertTestDatabase('postgresql://u:p@localhost:5432/test')).not.toThrow();
    expect(() => assertTestDatabase('postgresql://u:p@127.0.0.1/x')).not.toThrow();
    expect(() => assertTestDatabase('')).not.toThrow();
  });
  it('bloqueia endereço inválido', () => {
    expect(() => assertTestDatabase('lixo')).toThrow(/BLOQUEADO/);
  });
});
