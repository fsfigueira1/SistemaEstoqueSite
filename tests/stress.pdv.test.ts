// Teste de carga do caixa (rodar só no banco de teste): muitas vendas ao mesmo
// tempo, entradas de estoque, estornos, corridas (última unidade, clique
// duplo, cancelar x finalizar) e carrinho/pedido gigante. No fim confere se
// estoque e caixa batem com as movimentações.
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';
import { SaleService } from '@/services/saleService';
import { StockService } from '@/services/stockService';
import { CashSessionService } from '@/services/cashSessionService';
import { PurchaseService } from '@/services/purchaseService';

const EXPECTED = /Insufficient stock|already completed|already refunded|Cannot cancel a completed|Cannot complete a cancelled|Sale is already cancelled|Only pending/;
const errors: Record<string, number> = {};
const note = (e: unknown) => {
  const raw = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code;
  const m = raw.includes('Invalid `') ? `[${code}] ${raw.split('\n').filter(Boolean).slice(-2).join(' ')}` : raw;
  const k = m.replace(/[0-9a-z]{20,}/g, '<id>').replace(/Available: \d+, requested: \d+/, '').replace(/Produto \d+\.? ?/, 'Produto N').slice(0, 220);
  errors[k] = (errors[k] ?? 0) + 1;
  return m;
};
const unexpected = () => Object.entries(errors).filter(([k]) => !EXPECTED.test(k));

async function pool<T>(n: number, conc: number, job: (i: number) => Promise<T>) {
  let i = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (i < n) { const k = i++; await job(k).catch(note); }
  }));
}

let user: { id: string }, session: { id: string }, products: Array<{ id: string; salePrice: unknown }>, supplierId: string;
const INITIAL = 30;
const rnd = (n: number) => Math.floor(Math.random() * n);

async function sell(items: Array<{ productId: string; quantity: number }>, pay: 'cash' | 'pix' | 'split' = 'pix') {
  const { sale } = await SaleService.createSale({
    cashSessionId: session.id, createdById: user.id,
    items: items.map((i) => ({ ...i, unitPrice: Number(products.find((p) => p.id === i.productId)!.salePrice) })),
  });
  const total = sale.totalAmount;
  if (pay === 'cash') return SaleService.completeSale(sale.id, { amount: total + 10, changeAmount: 10, method: 'CASH', processedById: user.id });
  if (pay === 'split') {
    const half = Math.round((total / 2) * 100) / 100;
    return SaleService.completeSale(sale.id, { payments: [{ amount: half, method: 'CASH' }, { amount: Math.round((total - half) * 100) / 100, method: 'CREDIT_CARD', installmentCount: 3 }], processedById: user.id });
  }
  return SaleService.completeSale(sale.id, { amount: total, method: 'PIX', processedById: user.id });
}

describe('carga do caixa', () => {
  beforeAll(async () => {
    await cleanupDatabase();
    user = await prisma.user.create({ data: { name: 'Caixa', email: `caixa${Date.now()}@t.com`, password: 'x', role: 'ADMIN', status: 'ACTIVE' } });
    const reg = await prisma.cashRegister.create({ data: { name: 'PDV 1', isActive: true } });
    session = await CashSessionService.openCashSession({ cashRegisterId: reg.id, openedById: user.id, openingAmount: 100 });
    const cat = await prisma.category.create({ data: { name: 'Papelaria' } });
    supplierId = (await prisma.supplier.create({ data: { name: 'Fornecedor' } })).id;
    products = [];
    for (let i = 0; i < 40; i++) {
      products.push(await prisma.product.create({ data: { name: `Produto ${i}`, sku: `STRESS-${i}-${Date.now()}`, status: 'ACTIVE', costPrice: 2, salePrice: 3.33 + i, stockQuantity: INITIAL, minStockLevel: 1, categoryId: cat.id } }));
    }
  }, 120000);

  it('aguenta vendas, entradas e estornos ao mesmo tempo e o estoque bate', async () => {
    const done: string[] = [];
    const t0 = Date.now();
    await Promise.all([
      pool(300, 25, async (i) => {
        const items = Array.from({ length: 1 + rnd(12) }, () => ({ productId: products[rnd(products.length)].id, quantity: 1 + rnd(3) }));
        const s = await sell(items, (['cash', 'pix', 'split'] as const)[i % 3]);
        done.push(s.id!);
      }),
      pool(60, 5, async () => StockService.addStock({ productId: products[rnd(products.length)].id, quantity: 5, performedById: user.id, reference: 'carga' })),
      pool(40, 5, async () => {
        await new Promise((r) => setTimeout(r, 200 + rnd(3000)));
        const id = done[rnd(done.length)];
        if (id) await SaleService.refundSale(id);
      }),
    ]);
    console.log(`fase 1: ${Date.now() - t0} ms, vendas concluídas ${done.length}`);
  }, 300000);

  it('última unidade: 15 vendas ao mesmo tempo, só 1 leva', async () => {
    const p = products[0];
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 1 } });
    await prisma.stockMovement.create({ data: { productId: p.id, type: 'ADJUSTMENT_OUT', quantity: 0, performedById: user.id, reference: 'zera' } });
    const before = await prisma.product.findUnique({ where: { id: p.id } });
    const res = await Promise.allSettled(Array.from({ length: 15 }, () => sell([{ productId: p.id, quantity: 1 }])));
    const ok = res.filter((r) => r.status === 'fulfilled').length;
    res.forEach((r) => r.status === 'rejected' && note(r.reason));
    const after = await prisma.product.findUnique({ where: { id: p.id } });
    console.log(`última unidade: ${ok} venda(s) concluída(s), estoque ${before!.stockQuantity} → ${after!.stockQuantity}`);
    expect(ok).toBe(1);
    expect(after!.stockQuantity).toBe(0);
    // ajuste manual para a conferência final (estoque foi forçado para 1)
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 0 } });
  }, 60000);

  const restock = async () => {
    await prisma.$transaction(products.map((p) => prisma.product.update({ where: { id: p.id }, data: { stockQuantity: { increment: 100 } } })));
    await prisma.stockMovement.createMany({ data: products.map((p) => ({ productId: p.id, type: 'ADJUSTMENT_IN' as const, quantity: 100, performedById: user.id, reference: 'reforço' })) });
  };

  it('clique duplo em finalizar: 20 vendas finalizadas 2x ao mesmo tempo', async () => {
    await restock();
    let doubles = 0;
    for (let i = 0; i < 20; i++) {
      const p = products[1 + (i % 39)];
      const { sale } = await SaleService.createSale({ cashSessionId: session.id, createdById: user.id, items: [{ productId: p.id, quantity: 1, unitPrice: Number(p.salePrice) }] });
      const r = await Promise.allSettled([1, 2].map(() => SaleService.completeSale(sale.id, { amount: sale.totalAmount, method: 'PIX', processedById: user.id })));
      r.forEach((x) => x.status === 'rejected' && note(x.reason));
      if (r.filter((x) => x.status === 'fulfilled').length !== 1) doubles++;
    }
    expect(doubles).toBe(0);
  }, 120000);

  it('cancelar e finalizar a mesma venda ao mesmo tempo não deixa venda cancelada com estoque baixado', async () => {
    for (let i = 0; i < 30; i++) {
      const p = products[1 + (i % 39)];
      const { sale } = await SaleService.createSale({ cashSessionId: session.id, createdById: user.id, items: [{ productId: p.id, quantity: 1, unitPrice: Number(p.salePrice) }] });
      const r = await Promise.allSettled([
        SaleService.completeSale(sale.id, { amount: sale.totalAmount, method: 'PIX', processedById: user.id }),
        SaleService.cancelSale(sale.id),
      ]);
      r.forEach((x) => x.status === 'rejected' && note(x.reason));
    }
    // checado na conferência final
  }, 120000);

  it('carrinho de 150 itens e pedido de compra de 200 itens', async () => {
    const t0 = Date.now();
    await restock();
    const big = Array.from({ length: 150 }, (_, i) => ({ productId: products[1 + (i % 39)].id, quantity: 1 }));
    await sell(big, 'split');
    const t1 = Date.now();
    await PurchaseService.createPurchaseOrder({ supplierId, createdById: user.id, items: Array.from({ length: 200 }, (_, i) => ({ productId: products[i % 40].id, quantity: 10, unitCost: 2.5 })) });
    console.log(`carrinho 150 itens: ${t1 - t0} ms | pedido 200 itens: ${Date.now() - t1} ms`);
  }, 120000);

  it('conferência final: estoque e caixa batem com as movimentações', async () => {
    const problems: string[] = [];
    const moves = await prisma.stockMovement.groupBy({ by: ['productId', 'type'], _sum: { quantity: true } });
    for (const p of await prisma.product.findMany({ where: { id: { in: products.map((x) => x.id) } } })) {
      const sum = (t: string) => moves.find((m) => m.productId === p.id && m.type === t)?._sum.quantity ?? 0;
      const expected = INITIAL + sum('ADJUSTMENT_IN') + sum('SALE_RETURN') - sum('SALE') - sum('ADJUSTMENT_OUT');
      if (p.id !== products[0].id && p.stockQuantity !== expected) problems.push(`${p.name}: estoque ${p.stockQuantity}, movimentações dizem ${expected}`);
      if (p.stockQuantity < 0) problems.push(`${p.name}: estoque negativo ${p.stockQuantity}`);
    }
    const sales = await prisma.sale.findMany({ include: { items: true } });
    const saleMoves = await prisma.stockMovement.findMany({ where: { type: 'SALE' }, select: { reference: true } });
    const cash = await prisma.cashMovement.findMany({ where: { type: 'SALE' } });
    const movedSale = new Set(saleMoves.map((m) => m.reference));
    const cashSale = new Set(cash.map((c) => c.description?.replace('Sale ', '')));
    for (const s of sales) {
      const moved = movedSale.has(s.id);
      const paid = cashSale.has(s.saleNumber);
      if ((s.status === 'COMPLETED' || s.status === 'REFUNDED') && (!moved || !paid)) problems.push(`${s.saleNumber} ${s.status} sem baixa de estoque/caixa`);
      if ((s.status === 'CANCELLED' || s.status === 'PENDING') && (moved || paid)) problems.push(`${s.saleNumber} ${s.status} mas com estoque baixado/dinheiro no caixa`);
    }
    const byStatus = sales.reduce<Record<string, number>>((a, s) => ((a[s.status] = (a[s.status] ?? 0) + 1), a), {});
    console.log('vendas por situação', JSON.stringify(byStatus));
    console.log('erros (esperados e inesperados):', JSON.stringify(errors, null, 1));
    console.log('PROBLEMAS:', problems.length ? '\n' + problems.join('\n') : 'nenhum');
    expect(unexpected()).toEqual([]);
    expect(problems).toEqual([]);
  }, 60000);
});
