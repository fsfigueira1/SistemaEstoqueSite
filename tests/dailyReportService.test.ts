import { describe, it, expect } from 'vitest';
import { summarizeStats } from '../src/services/dailyReportService';

describe('summarizeStats', () => {
  it('maps sale statistics to the daily report shape', () => {
    const out = summarizeStats({
      count: 12,
      totals: { totalAmount: 1234.5 },
      averages: { totalAmount: 102.875 },
    });
    expect(out).toEqual({ salesCount: 12, totalAmount: 1234.5, averageTicket: 102.875 });
  });

  it('reports a zero ticket when there were no sales', () => {
    const out = summarizeStats({ count: 0, totals: { totalAmount: 0 }, averages: { totalAmount: 0 } });
    expect(out).toEqual({ salesCount: 0, totalAmount: 0, averageTicket: 0 });
  });

  it('coerces a null average (Prisma _avg with no rows) to 0', () => {
    const out = summarizeStats({
      count: 0,
      totals: { totalAmount: 0 },
      averages: { totalAmount: null as unknown as number },
    });
    expect(out.averageTicket).toBe(0);
  });
});
