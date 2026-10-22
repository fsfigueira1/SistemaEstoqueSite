import { describe, beforeEach, it, expect } from 'vitest';
import { buildAssistantContext } from '../src/services/assistantService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { CashSessionService } from '../src/services/cashSessionService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600_000);

describe('buildAssistantContext', () => {
  let userId: string;
  let sessionId: string;
  let catId: string;
  let seq = 0;

  const product = (name: string, stock: number, min = 5) =>
    prisma.product.create({ data: { name, sku: `AS${++seq}`, categoryId: catId, salePrice: 10, stockQuantity: stock, minStockLevel: min } });

  const sale = (when: Date, items: Array<{ productId: string; qty: number }>, method: 'CASH' | 'PIX' | 'CREDIT_CARD', status: 'COMPLETED' | 'CANCELLED' = 'COMPLETED') => {
    const total = items.reduce((s, i) => s + i.qty * 10, 0);
    return prisma.sale.create({
      data: {
        saleNumber: `T${++seq}`,
        cashSessionId: sessionId,
        status,
        subtotal: total,
        totalAmount: total,
        paidAmount: total,
        createdById: userId,
        createdAt: when,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.qty, unitPrice: 10, totalAmount: i.qty * 10, createdAt: when })) },
        payments: { create: [{ method, amount: total, status: 'PAID', processedById: userId, createdAt: when }] },
      },
    });
  };

  beforeEach(async () => {
    await cleanupDatabase();
    userId = (await createAdminUser()).id;
    const reg = await CashRegisterService.createCashRegister({ name: 'Caixa', description: '', isActive: true });
    sessionId = (await CashSessionService.openCashSession({ cashRegisterId: reg.id, openedById: userId, openingAmount: 0 })).id;
    catId = (await prisma.category.create({ data: { name: 'Escolar' } })).id;
  });

  it('soma vendas por período e lista estoque baixo, sem estoque e parados', async () => {
    const lapis = await product('Lápis', 50);
    const cola = await product('Cola', 2); // baixo
    await product('Régua', 0); // sem estoque
    await product('Compasso', 8); // parado (nunca vendeu)

    await sale(new Date(), [{ productId: lapis.id, qty: 3 }], 'PIX'); // hoje: 30
    await sale(daysAgo(3), [{ productId: lapis.id, qty: 2 }, { productId: cola.id, qty: 1 }], 'CASH'); // 7d: +30
    await sale(daysAgo(10), [{ productId: lapis.id, qty: 1 }], 'CREDIT_CARD'); // anteriores7: 10
    await sale(daysAgo(1), [{ productId: lapis.id, qty: 9 }], 'CASH', 'CANCELLED'); // não conta

    const ctx = await buildAssistantContext();
    expect(ctx.hoje).toMatchObject({ vendas: 1, faturamento: 30, pix: 30 });
    expect(ctx.ultimos7).toMatchObject({ vendas: 2, faturamento: 60, dinheiro: 30, pix: 30 });
    expect(ctx.anteriores7).toMatchObject({ vendas: 1, faturamento: 10, cartao: 10 });
    expect(ctx.ultimos30.faturamento).toBe(70);
    expect(ctx.maisVendidos30[0]).toMatchObject({ nome: 'Lápis', quantidade: 6 });
    expect(ctx.estoqueBaixo.map((p) => p.nome)).toContain('Cola');
    expect(ctx.semEstoque).toContain('Régua');
    expect(ctx.parados.map((p) => p.nome)).toContain('Compasso');
    expect(ctx.parados.map((p) => p.nome)).not.toContain('Lápis');
  });
});
