import { describe, beforeEach, it, expect } from 'vitest';
import { QuoteRequestService, type QuoteItem } from '../src/services/quoteRequestService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

describe('QuoteRequestService', () => {
  let lapis: { id: string };
  let cola: { id: string };
  let items: QuoteItem[];

  const base = (over: Partial<Parameters<typeof QuoteRequestService.create>[0]> = {}) => ({
    name: 'Ana Souza',
    phone: '(17) 99999-8888' as string | null,
    source: 'whatsapp' as const,
    title: 'sua lista',
    items,
    toConfirm: ['1 × compasso'],
    total: 9,
    message: 'Oi, Ana! Segue o orçamento…',
    ...over,
  });

  beforeEach(async () => {
    await cleanupDatabase();
    const cat = await prisma.category.create({ data: { name: 'Escolar' } });
    lapis = await prisma.product.create({ data: { name: 'Lápis HB', sku: 'QL1', categoryId: cat.id, salePrice: 2.5, stockQuantity: 50 } });
    cola = await prisma.product.create({ data: { name: 'Cola', sku: 'QC1', categoryId: cat.id, salePrice: 4, stockQuantity: 10 } });
    items = [
      { qty: 2, text: 'lápis', productId: lapis.id, price: 2.5, take: 2 },
      { qty: 1, text: 'cola', productId: cola.id, price: 4, take: 1 },
    ];
  });

  it('salva sem telefone (e não cria contato)', async () => {
    const { id } = await QuoteRequestService.create(base({ phone: null }));
    const q = await QuoteRequestService.get(id);
    expect(q).toMatchObject({ name: 'Ana Souza', phone: null, status: 'aberto' });
    const bad = await QuoteRequestService.create(base({ phone: '123' }));
    expect((await QuoteRequestService.get(bad.id))!.phone).toBeNull();
    expect(await prisma.contact.count()).toBe(0);
  });

  it('cria contato pendente sem mexer no existente', async () => {
    await QuoteRequestService.create(base());
    const c = await prisma.contact.findUniqueOrThrow({ where: { phone: '5517999998888' } });
    expect(c).toMatchObject({ name: 'Ana Souza', source: 'whatsapp', optInAt: null });
    await prisma.contact.update({ where: { id: c.id }, data: { optOutAt: new Date(), name: 'Ana' } });
    await QuoteRequestService.create(base({ name: 'Outro nome' }));
    const again = await prisma.contact.findUniqueOrThrow({ where: { phone: '5517999998888' } });
    expect(again.name).toBe('Ana');
    expect(again.optOutAt).not.toBeNull();
  });

  it('dois pedidos do mesmo telefone ficam separados', async () => {
    await QuoteRequestService.create(base());
    await QuoteRequestService.create(base({ total: 20 }));
    const list = await QuoteRequestService.list({});
    expect(list).toHaveLength(2);
    expect(list[0].total).toBe(20); // mais novo primeiro
    expect(list[0]).toMatchObject({ phone: '5517999998888', itemCount: 2, status: 'aberto' });
  });

  it('busca por nome sem acento e por telefone', async () => {
    await QuoteRequestService.create(base({ name: 'Júlia Ramos', phone: '17988887777' }));
    await QuoteRequestService.create(base());
    expect((await QuoteRequestService.list({ q: 'julia' })).map((q) => q.name)).toEqual(['Júlia Ramos']);
    expect((await QuoteRequestService.list({ q: '98888-7777' })).map((q) => q.name)).toEqual(['Júlia Ramos']);
    expect(await QuoteRequestService.list({ q: 'ana', status: 'retirado' })).toHaveLength(0);
  });

  it('detalhe traz preço de agora', async () => {
    const { id } = await QuoteRequestService.create(base());
    await prisma.product.update({ where: { id: lapis.id }, data: { salePrice: 3 } });
    await prisma.product.update({ where: { id: cola.id }, data: { status: 'INACTIVE' } });
    const q = await QuoteRequestService.get(id);
    expect(q!.items[0]).toMatchObject({ price: 2.5, now: { price: 3, stock: 50, active: true } });
    expect(q!.items[1].now).toMatchObject({ active: false });
    expect(q!.toConfirm).toEqual(['1 × compasso']);
  });

  it('setStatus muda e recusa valor inválido', async () => {
    const { id } = await QuoteRequestService.create(base());
    await QuoteRequestService.setStatus(id, 'retirado');
    expect((await QuoteRequestService.get(id))!.status).toBe('retirado');
    await expect(QuoteRequestService.setStatus(id, 'perdido')).rejects.toThrow('Situação inválida');
  });

  it('limpa valores vindos da tela e marca contato do balcão como manual', async () => {
    const { id } = await QuoteRequestService.create(
      base({ source: 'balcao', total: -5, toConfirm: ['x'.repeat(500)], items: [{ qty: 1, text: 'lápis', productId: lapis.id, price: -2, take: 1 }] }),
    );
    const q = await QuoteRequestService.get(id);
    expect(q!.total).toBe(0);
    expect(q!.items[0].price).toBe(0);
    expect(q!.toConfirm[0].length).toBeLessThanOrEqual(200);
    expect((await prisma.contact.findUniqueOrThrow({ where: { phone: '5517999998888' } })).source).toBe('manual');
  });
});
