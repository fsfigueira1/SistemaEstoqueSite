// Venda nunca some e nunca duplica: idempotência do checkout, retentativas
// da fila offline, estorno em dobro e a última unidade vendida em 2 PCs.
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { POST as checkout } from '../src/app/api/sales/checkout/route';
import { SaleService } from '../src/services/saleService';
import { ProductService } from '../src/services/productService';
import { CashSessionService } from '../src/services/cashSessionService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { getSystemUserId } from '../src/lib/systemUser';
import { isAlreadyApplied } from '../src/lib/schemaUpgrade';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

let session: { id: string };
let product: { id: string };
let userId: string;

const post = (body: unknown) =>
  checkout(new Request('http://localhost/api/sales/checkout', { method: 'POST', body: JSON.stringify(body) }));

const stockOf = async (id: string) => (await prisma.product.findUnique({ where: { id } }))!.stockQuantity;

describe('Checkout robusto', () => {
  beforeAll(async () => {
    await cleanupDatabase();
    userId = await getSystemUserId();
    const category = await prisma.category.create({ data: { name: 'Robustez' } });
    product = await prisma.product.create({
      data: { name: 'Caneta', sku: 'ROB001', categoryId: category.id, costPrice: 1, salePrice: 19.9, stockQuantity: 10, status: 'ACTIVE' },
    });
    const reg = await CashRegisterService.createCashRegister({ name: 'Caixa R', isActive: true });
    session = await CashSessionService.openCashSession({ cashRegisterId: reg.id, openedById: userId, openingAmount: 0 });
  }, 60_000);

  afterAll(async () => {
    await cleanupDatabase();
  });

  beforeEach(async () => {
    await prisma.salePayment.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 10 } });
  });

  const body = (clientId: string, qty = 3, extra: Record<string, unknown> = {}) => ({
    clientId,
    cashSessionId: session.id,
    items: [{ productId: product.id, quantity: qty, unitPrice: 19.9 }],
    payments: [{ method: 'PIX', amount: Math.round(19.9 * qty * 100) / 100 }],
    ...extra,
  });

  it('grava a venda uma vez só, mesmo reenviada com o mesmo clientId', async () => {
    const r1 = await post(body('cid-1'));
    expect(r1.status).toBe(201);
    const r2 = await post(body('cid-1', 3, { queued: true }));
    expect(r2.status).toBe(200);
    expect((await r2.json()).idempotent).toBe(true);
    expect(await prisma.sale.count({ where: { status: 'COMPLETED' } })).toBe(1);
    expect(await stockOf(product.id)).toBe(7);
  }, 60_000);

  it('arredonda o total em centavos (3 x 19,90 = 59,70)', async () => {
    const r = await post(body('cid-cents'));
    const data = (await r.json()).data;
    expect(Number(data.totalAmount)).toBe(59.7);
  }, 60_000);

  it('uma tentativa que ficou PENDENTE não faz a fila apagar a venda', async () => {
    // simula: processo morreu entre criar e concluir
    await SaleService.createSale({
      cashSessionId: session.id,
      createdById: userId,
      items: [{ productId: product.id, quantity: 3, unitPrice: 19.9 }],
      clientId: 'cid-pend',
    });
    const r = await post(body('cid-pend', 3, { queued: true }));
    expect(r.status).toBe(201);
    const sales = await prisma.sale.findMany({ orderBy: { createdAt: 'asc' } });
    expect(sales.filter((s) => s.status === 'COMPLETED')).toHaveLength(1);
    expect(sales.filter((s) => s.status === 'CANCELLED')).toHaveLength(1);
    expect(sales.find((s) => s.status === 'CANCELLED')!.clientId).toBeNull();
    expect(await stockOf(product.id)).toBe(7);
  }, 60_000);

  it('uma tentativa que falhou (cancelada) não impede gravar de novo', async () => {
    // pagamento errado → conclusão falha → venda desfeita
    const bad = await post(body('cid-fail', 3, { payments: [{ method: 'PIX', amount: 1 }] }));
    expect(bad.status).toBe(409);
    const ok = await post(body('cid-fail'));
    expect(ok.status).toBe(201);
    expect(await prisma.sale.count({ where: { status: 'COMPLETED' } })).toBe(1);
    expect(await stockOf(product.id)).toBe(7);
  }, 60_000);

  it('mesma venda enviada 3x ao mesmo tempo: grava uma, as outras pedem para tentar de novo', async () => {
    const rs = await Promise.all([post(body('cid-par', 2)), post(body('cid-par', 2, { queued: true })), post(body('cid-par', 2, { queued: true }))]);
    for (const r of rs) expect([200, 201, 409, 503]).toContain(r.status);
    // tentando de novo depois, todas enxergam a mesma venda
    const again = await post(body('cid-par', 2, { queued: true }));
    expect([200, 201]).toContain(again.status);
    expect(await prisma.sale.count({ where: { status: 'COMPLETED' } })).toBe(1);
    expect(await stockOf(product.id)).toBe(8);
  }, 60_000);

  it('dois PCs vendendo a última unidade: só um consegue', async () => {
    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 1 } });
    const [a, b] = await Promise.all([post(body('cid-a', 1)), post(body('cid-b', 1))]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await stockOf(product.id)).toBe(0);
  }, 60_000);

  it('estorno em dobro devolve o estoque uma vez só', async () => {
    const r = await post(body('cid-ref'));
    const saleId = (await r.json()).data.id;
    const results = await Promise.allSettled([SaleService.refundSale(saleId), SaleService.refundSale(saleId)]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await stockOf(product.id)).toBe(10);
    expect(await prisma.stockMovement.count({ where: { reference: saleId, type: 'SALE_RETURN' } })).toBe(1);
  }, 60_000);

  it('editar o produto não desfaz venda de outro PC (aplica só a diferença)', async () => {
    // tela abriu com 10; outro PC vendeu 3 (fica 7); a tela salva 12 (+2)
    await post(body('cid-edit'));
    expect(await stockOf(product.id)).toBe(7);
    await ProductService.updateProduct(product.id, { stockQuantity: 12 }, { stockOriginal: 10, userId });
    expect(await stockOf(product.id)).toBe(9);
    // salvou sem mexer no estoque: continua 9
    await ProductService.updateProduct(product.id, { stockQuantity: 10, name: 'Caneta azul' }, { stockOriginal: 10, userId });
    expect(await stockOf(product.id)).toBe(9);
  }, 60_000);

  it('abrir o caixa em 2 PCs ao mesmo tempo abre uma sessão só', async () => {
    const reg = await CashRegisterService.createCashRegister({ name: 'Caixa Duplo', isActive: true });
    const open = () => CashSessionService.openCashSession({ cashRegisterId: reg.id, openedById: userId, openingAmount: 0 });
    await Promise.allSettled([open(), open(), open()]);
    expect(await prisma.cashSession.count({ where: { cashRegisterId: reg.id, status: 'OPEN' } })).toBe(1);
  }, 60_000);
});

describe('Atualização do banco', () => {
  it('pula o que já existe', () => {
    const have = { cols: new Set(['Settings.storeCity']), rels: new Set(['DailyClosing', 'DailyClosing_date_key']) };
    expect(isAlreadyApplied(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "storeCity" TEXT`, have)).toBe(true);
    expect(isAlreadyApplied(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "nova" TEXT`, have)).toBe(false);
    expect(isAlreadyApplied(`CREATE TABLE IF NOT EXISTS "DailyClosing" (x int)`, have)).toBe(true);
    expect(isAlreadyApplied(`CREATE UNIQUE INDEX IF NOT EXISTS "DailyClosing_date_key" ON "DailyClosing"("date")`, have)).toBe(true);
    expect(isAlreadyApplied(`CREATE INDEX IF NOT EXISTS "Outro_idx" ON "X"("y")`, have)).toBe(false);
  });
});
