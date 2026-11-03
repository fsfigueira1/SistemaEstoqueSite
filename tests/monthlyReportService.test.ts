import { describe, beforeEach, it, expect } from 'vitest';
import { getMonthlyReport, monthRange, prevMonth } from '../src/services/monthlyReportService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { CashSessionService } from '../src/services/cashSessionService';
import { reasonNote } from '../src/lib/stockReasons';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

const at = (iso: string) => new Date(`${iso}-03:00`);

describe('Relatório do mês', () => {
  let userId: string;
  let sessionId: string;
  let lapis: { id: string };
  let n = 0;

  async function sale(when: string, total: number, method: 'CASH' | 'PIX' | 'CREDIT_CARD', qty = 1, status: 'COMPLETED' | 'CANCELLED' = 'COMPLETED') {
    n += 1;
    await prisma.sale.create({
      data: {
        saleNumber: `T${n}`,
        cashSessionId: sessionId,
        createdById: userId,
        status,
        subtotal: total,
        totalAmount: total,
        paidAmount: total,
        createdAt: at(when),
        items: { create: [{ productId: lapis.id, quantity: qty, unitPrice: total / qty, totalAmount: total }] },
        payments: { create: [{ method, amount: total, status: 'PAID', processedById: userId }] },
      },
    });
  }

  beforeEach(async () => {
    await cleanupDatabase();
    userId = (await createAdminUser()).id;
    const reg = await CashRegisterService.createCashRegister({ name: 'Caixa', description: '', isActive: true });
    sessionId = (await CashSessionService.openCashSession({ cashRegisterId: reg.id, openedById: userId, openingAmount: 0 })).id;
    const cat = await prisma.category.create({ data: { name: 'Escolar' } });
    lapis = await prisma.product.create({ data: { name: 'Lápis HB', sku: 'LAP', categoryId: cat.id, costPrice: 1.2, salePrice: 2.5, stockQuantity: 100 } });
  });

  it('mês em Brasília e mês anterior', () => {
    const r = monthRange('2026-10');
    expect(r.start.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(prevMonth('2026-01')).toBe('2025-12');
  });

  it('vendas, formas de pagamento, dia a dia e mais vendidos (só concluídas do mês)', async () => {
    await sale('2026-10-05T10:00:00', 10, 'CASH', 4);
    await sale('2026-10-05T15:00:00', 20, 'PIX', 8);
    await sale('2026-10-31T23:30:00', 5, 'CREDIT_CARD', 2); // 31/10 à noite em Brasília ainda é outubro
    await sale('2026-10-10T10:00:00', 999, 'CASH', 1, 'CANCELLED');
    await sale('2026-09-20T10:00:00', 70, 'CASH', 1); // mês anterior

    const r = await getMonthlyReport('2026-10');
    expect(r.sales).toMatchObject({ count: 3, revenue: 35, previousRevenue: 70 });
    expect(r.methods).toEqual({ cash: 10, pix: 20, card: 5 });
    expect(r.days).toHaveLength(31);
    expect(r.days.find((d) => d.date === '2026-10-05')).toEqual({ date: '2026-10-05', revenue: 30, count: 2 });
    expect(r.days.find((d) => d.date === '2026-10-31')?.revenue).toBe(5);
    expect(r.topProducts[0]).toMatchObject({ name: 'Lápis HB', quantity: 14, revenue: 35 });
  });

  it('ajustes de estoque: cada saída com motivo, explicação e custo; entradas à parte', async () => {
    const mv = (type: 'LOSS' | 'THEFT' | 'ADJUSTMENT_OUT' | 'ADJUSTMENT_IN', quantity: number, notes: string, when: string) =>
      prisma.stockMovement.create({ data: { productId: lapis.id, type, quantity, notes, performedById: userId, createdAt: at(when) } });
    await mv('LOSS', 3, reasonNote('perda', 'caixa molhou na chuva'), '2026-10-03T09:00:00');
    await mv('THEFT', 2, reasonNote('furto', 'sumiram da vitrine'), '2026-10-12T17:00:00');
    await mv('ADJUSTMENT_OUT', 1, 'Ajuste na edição do produto (10 → 9)', '2026-10-15T11:00:00'); // antigo, sem motivo
    await mv('ADJUSTMENT_IN', 5, 'achado no depósito', '2026-10-20T11:00:00');
    await mv('LOSS', 9, reasonNote('perda', 'de outro mês'), '2026-11-02T11:00:00');

    const r = await getMonthlyReport('2026-10');
    expect(r.adjustments).toHaveLength(4);
    const furto = r.adjustments.find((a) => a.reason === 'Furto');
    expect(furto).toMatchObject({ product: 'Lápis HB', direction: 'saida', quantity: 2, explanation: 'sumiram da vitrine' });
    expect(furto?.cost).toBeCloseTo(2.4);
    expect(r.adjustments.find((a) => a.quantity === 1)).toMatchObject({ reason: 'Saída manual', explanation: 'Ajuste na edição do produto (10 → 9)' });
    expect(r.adjustmentSummary.outUnits).toBe(6);
    expect(r.adjustmentSummary.outCost).toBeCloseTo(7.2);
    expect(r.adjustmentSummary.inUnits).toBe(5);
    expect(r.adjustmentSummary.byReason[0]).toMatchObject({ reason: 'Perda / quebra / vencido', quantity: 3 });
  });
});
