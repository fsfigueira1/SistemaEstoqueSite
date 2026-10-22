import { describe, beforeEach, it, expect } from 'vitest';
import { CopilotService } from '../src/services/copilotService';
import { QuoteRequestService } from '../src/services/quoteRequestService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

const PEDIDO_SITE = `Olá! Vim pelo site e quero um orçamento para retirar na loja:

*3º ano · Fundamental*
Material escolar:
- 2x Lápis HB [SKU QLAP]
- 1x Tinta guache 6 cores
Uniforme:
- 1x Camiseta manga cobalto, tamanho 2 [SKU QCAM]

Obrigado!
#ORC-SITE v1`;

describe('CopilotService.draft', () => {
  const calls: Array<{ system: string; user: string }> = [];
  const ai = async (system: string, user: string) => {
    calls.push({ system, user });
    return 'Oi, Ana! Segue o seu orçamento 😊';
  };
  const failing = async () => {
    throw new Error('NVIDIA fora do ar');
  };

  beforeEach(async () => {
    calls.length = 0;
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { companyName: 'Laçolaria', companyAddress: 'Av. Comendador Mançor Daud, 563', storeHours: 'Seg a sex 8h às 18h' },
      create: { id: 'app', companyName: 'Laçolaria', companyAddress: 'Av. Comendador Mançor Daud, 563', storeHours: 'Seg a sex 8h às 18h' },
    });
    const cat = await prisma.category.create({ data: { name: 'Escolar' } });
    await prisma.product.create({ data: { name: 'Lápis HB', sku: 'QLAP', categoryId: cat.id, salePrice: 2.5, stockQuantity: 50 } });
    await prisma.product.create({ data: { name: 'Borracha branca', sku: 'QBOR', categoryId: cat.id, salePrice: 1.8, stockQuantity: 30 } });
    await prisma.product.create({ data: { name: 'Camiseta manga curta Cobalto - Tam 2', sku: 'QCAM', categoryId: cat.id, salePrice: 39.9, stockQuantity: 5 } });
  });

  it('lista vira orçamento salvo com abertura da IA', async () => {
    const r = await CopilotService.draft({ name: 'Ana Souza', phone: '17999998888', text: '2 lápis\n1 borracha\n1 compasso' }, { ai });
    expect(r.intent).toBe('list');
    expect(r.reply.startsWith('Oi, Ana! Segue o seu orçamento 😊\n\n')).toBe(true);
    expect(r.reply).toMatch(/Lápis HB[\s\S]*Borracha branca/);
    expect(r.reply).toMatch(/Total: R\$\s?6,80/);
    expect(r.reply).toMatch(/A loja confirma[\s\S]*1 × compasso/);
    expect(r.reply).toContain('Av. Comendador Mançor Daud, 563');
    expect(r.total).toBe(6.8);
    // a IA não recebe a tarefa de escrever preço: só a abertura
    expect(calls[0].system).toMatch(/abertura/i);
    const saved = await QuoteRequestService.get(r.quoteRequestId!);
    expect(saved).toMatchObject({ name: 'Ana Souza', phone: '5517999998888', total: 6.8, source: 'whatsapp' });
    expect(saved!.items).toHaveLength(2);
    expect(saved!.toConfirm).toEqual(['1 × compasso']);
  });

  it('pedido do site deixa uniforme para a loja confirmar', async () => {
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: PEDIDO_SITE }, { ai });
    expect(r.intent).toBe('site');
    expect(r.reply).toMatch(/2 × Lápis HB/);
    expect(r.reply).not.toMatch(/Camiseta[^\n]*R\$/);
    expect(r.reply).toMatch(/A loja confirma[\s\S]*Tinta guache[\s\S]*Camiseta manga cobalto, tamanho 2/);
    expect(r.total).toBe(5);
  });

  it('pergunta comum não salva orçamento', async () => {
    const r = await CopilotService.draft({ name: 'Ana', phone: '17999998888', text: 'Bom dia!\nQue horas vocês abrem?' }, { ai });
    expect(r.intent).toBe('other');
    expect(r.quoteRequestId).toBeNull();
    expect(await prisma.quoteRequest.count()).toBe(0);
    expect(calls[0].system).toContain('Seg a sex 8h às 18h');
    expect(r.reply).toBe('Oi, Ana! Segue o seu orçamento 😊');
  });

  it('sem IA ainda responde', async () => {
    const q = await CopilotService.draft({ name: 'Ana Souza', phone: '', text: '2 lápis\n1 borracha' }, { ai: failing });
    expect(q.reply.startsWith('Oi, Ana! Segue o orçamento:')).toBe(true);
    expect(q.quoteRequestId).not.toBeNull();
    const o = await CopilotService.draft({ name: '', phone: '', text: 'que horas abrem?' }, { ai: failing });
    expect(o.reply).toContain('Seg a sex 8h às 18h');
    expect(o.reply).toContain('Av. Comendador Mançor Daud, 563');
  });

  it('código inexistente pede a lista', async () => {
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Quero o orçamento #L-ZZZZ' }, { ai });
    expect(r.intent).toBe('code');
    expect(r.quoteRequestId).toBeNull();
    expect(r.reply).toMatch(/Não encontrei essa lista/);
  });
});
