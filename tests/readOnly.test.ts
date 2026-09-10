import { describe, it, expect } from 'vitest';
import { readOnlyDecision } from '../src/lib/readOnly';

const RO = { READ_ONLY: '1', CRON_SECRET: 's3cr3t' };

describe('readOnlyDecision', () => {
  it('allows everything when READ_ONLY is not "1"', () => {
    expect(readOnlyDecision({ method: 'POST', pathname: '/api/products', headers: {}, env: {} }).allow).toBe(true);
  });

  it('allows GET/HEAD/OPTIONS under READ_ONLY', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(readOnlyDecision({ method, pathname: '/api/products', headers: {}, env: RO }).allow).toBe(true);
    }
  });

  it('blocks a mutating method under READ_ONLY with 403', () => {
    const d = readOnlyDecision({ method: 'POST', pathname: '/api/products', headers: {}, env: RO });
    expect(d.allow).toBe(false);
    expect(d.status).toBe(403);
  });

  it('lets the cron route through with the right bearer secret', () => {
    const d = readOnlyDecision({
      method: 'POST',
      pathname: '/api/cron/daily-report',
      headers: { authorization: 'Bearer s3cr3t' },
      env: RO,
    });
    expect(d.allow).toBe(true);
  });

  it('blocks the cron route when the bearer secret is wrong or missing', () => {
    expect(
      readOnlyDecision({ method: 'POST', pathname: '/api/cron/daily-report', headers: { authorization: 'Bearer nope' }, env: RO }).allow,
    ).toBe(false);
    expect(
      readOnlyDecision({ method: 'POST', pathname: '/api/cron/daily-report', headers: {}, env: RO }).allow,
    ).toBe(false);
  });

  it('does not treat a non-cron path as authorized just because the secret matches', () => {
    const d = readOnlyDecision({
      method: 'POST',
      pathname: '/api/products',
      headers: { authorization: 'Bearer s3cr3t' },
      env: RO,
    });
    expect(d.allow).toBe(false);
  });
});
