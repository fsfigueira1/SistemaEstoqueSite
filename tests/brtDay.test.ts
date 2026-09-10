import { describe, it, expect } from 'vitest';
import { brtDayString, brtDayRange } from '../src/lib/brtDay';

describe('brtDayString', () => {
  it('keeps a 23:30 BRT sale on the same civil day (not the next UTC day)', () => {
    // 2026-03-10 23:30 in America/Sao_Paulo == 2026-03-11 02:30 UTC
    const d = new Date('2026-03-11T02:30:00.000Z');
    expect(brtDayString(d)).toBe('2026-03-10');
  });

  it('rolls to the next day once BRT passes midnight', () => {
    // 2026-03-11 00:15 BRT == 2026-03-11 03:15 UTC
    const d = new Date('2026-03-11T03:15:00.000Z');
    expect(brtDayString(d)).toBe('2026-03-11');
  });

  it('formats single-digit month and day with leading zeros', () => {
    const d = new Date('2026-01-05T12:00:00.000Z');
    expect(brtDayString(d)).toBe('2026-01-05');
  });
});

describe('brtDayRange', () => {
  it('returns the UTC instants that bound a BRT civil day', () => {
    const { start, end } = brtDayRange('2026-03-10');
    // BRT is UTC-3: day starts 03:00 UTC, ends 03:00 UTC next day
    expect(start.toISOString()).toBe('2026-03-10T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-11T03:00:00.000Z');
  });

  it('is a half-open range: end is exclusive start of next day', () => {
    const { end } = brtDayRange('2026-03-10');
    const next = brtDayRange('2026-03-11');
    expect(end.toISOString()).toBe(next.start.toISOString());
  });
});
