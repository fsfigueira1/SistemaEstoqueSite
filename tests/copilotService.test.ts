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
    expect(r.fallback).toBeFalsy();
  });

  it('a IA recebe as informações da loja (pagamento etc.) e avisa quando caiu no texto reserva', async () => {
    await prisma.settings.update({ where: { id: 'app' }, data: { storeInfo: 'Pagamento: Pix, débito, crédito e dinheiro, na loja.' } });
    await CopilotService.draft({ name: 'Ana', phone: '', text: 'Vocês aceitam pix?' }, { ai });
    expect(calls[0].system).toContain('Pagamento: Pix, débito, crédito e dinheiro, na loja.');
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Vocês aceitam pix?' }, { ai: failing });
    expect(r.fallback).toBe(true);
  });

  it('"tem X?" busca no estoque: lista o que tem, com o preço do sistema', async () => {
    const cat = await prisma.category.findFirst();
    await prisma.product.createMany({
      data: [
        { name: 'Stabilo Boss Original Azul Pastel', sku: 'QST1', categoryId: cat!.id, salePrice: 14.9, stockQuantity: 12 },
        { name: 'Stabilo Boss Original Azul Nevoa Pastel', sku: 'QST2', categoryId: cat!.id, salePrice: 14.9, stockQuantity: 0 },
        { name: 'Marca Texto Multicolor Pastel Azul', sku: 'QMT1', categoryId: cat!.id, salePrice: 6, stockQuantity: 5 },
      ],
    });
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Oi! Tem stabilo pastel azul?' }, { ai });
    expect(r.intent).toBe('product');
    expect(r.productFound).toBe(true);
    expect(r.reply).toContain('Stabilo Boss Original Azul Pastel — R$');
    expect(r.reply).toContain('14,90');
    expect(r.reply).not.toContain('Nevoa'); // sem estoque não entra como "temos"
    expect(r.reply).not.toContain('Multicolor'); // achou o exato: não mistura outra marca
    expect(calls.at(-1)!.system).toMatch(/abertura/i); // a IA só escreve a abertura
    expect(await prisma.quoteRequest.count()).toBe(0);

    // tipo do produto fora do nome do cadastro: "caderno do batman" acha "FORONI BATMAN 80 FOLHAS"
    await prisma.product.create({ data: { name: 'FORONI BATMAN 80 FOLHAS', sku: 'QBAT', categoryId: cat!.id, salePrice: 29.9, stockQuantity: 4 } });
    await prisma.product.create({ data: { name: 'Caderno Tilibra Frozen 96 folhas', sku: 'QFRZ', categoryId: cat!.id, salePrice: 19.9, stockQuantity: 4 } });
    await prisma.product.create({ data: { name: 'Caderno Foroni Liso 96 folhas', sku: 'QLIS', categoryId: cat!.id, salePrice: 15.9, stockQuantity: 4 } });
    const bat = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Tem aquele caderno do batman?' }, { ai });
    expect(bat.productFound).toBe(true);
    expect(bat.reply).toContain('FORONI BATMAN 80 FOLHAS');
    expect(bat.reply).not.toContain('Frozen');

    const none = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Vocês têm caneta de unicórnio dourada?' }, { ai });
    expect(none.intent).toBe('product');
    expect(none.productFound).toBe(false);
    expect(none.reply).not.toMatch(/não temos/i); // nunca diz "não temos" sem conferir
  });

  it('a IA sabe que dia e hora é agora em Brasília (para "amanhã", "hoje", "está aberto?")', async () => {
    await CopilotService.draft({ name: 'Ana', phone: '', text: 'Que horas abrem amanhã?' }, { ai, now: new Date('2026-10-24T14:15:00-03:00') });
    expect(calls[0].system).toMatch(/Agora: sábado, 24\/10\/2026.*14:15/);
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

  it('"Bom dia" não vira item mesmo com produto "Dia a Dia"', async () => {
    const cat = await prisma.category.findFirstOrThrow();
    await prisma.product.create({ data: { name: 'Agenda Dia a Dia 2027', sku: 'QAGE', categoryId: cat.id, salePrice: 29.9, stockQuantity: 5 } });
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Bom dia!\nQue horas vocês abrem?' }, { ai });
    expect(r.intent).toBe('other');
    expect(await prisma.quoteRequest.count()).toBe(0);
  });

  it('item sem quantidade e não reconhecido vai para a loja confirmar', async () => {
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'lápis\nborracha\ncompasso' }, { ai });
    expect(r.reply).toMatch(/A loja confirma[\s\S]*compasso/);
  });

  it('resposta comum com preço da IA é trocada pela resposta fixa', async () => {
    const pricey = async () => 'O caderno custa R$ 20, vem buscar!';
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'quanto tá o caderno?' }, { ai: pricey });
    expect(r.reply).not.toMatch(/R\$/);
    expect(r.reply).toContain('Seg a sex 8h às 18h');
    const reais = async () => 'Sai por uns 20 reais';
    expect((await CopilotService.draft({ name: 'Ana', phone: '', text: 'e a mochila?' }, { ai: reais })).reply).not.toMatch(/reais/);
  });

  it('pedido sem nenhum item com preço não salva orçamento de R$ 0,00', async () => {
    const texto = 'Material escolar:\n- 1x Tinta guache\nUniforme:\n- 1x Camiseta manga cobalto, tamanho 2 [SKU QCAM]\n#ORC-SITE v1';
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: texto }, { ai });
    expect(r.quoteRequestId).toBeNull();
    expect(r.reply).not.toMatch(/Total/);
    expect(r.reply).toMatch(/Tinta guache[\s\S]*Camiseta/);
  });

  it('SKU desconhecido do site fica para a loja confirmar, não "não temos"', async () => {
    const texto = '- 2x Lápis HB [SKU QLAP]\n- 1x Estojo azul [SKU NAOEXISTE]\n#ORC-SITE v1';
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: texto }, { ai });
    expect(r.reply).not.toMatch(/Não temos no momento/);
    expect(r.reply).toMatch(/A loja confirma[\s\S]*Estojo azul/);
  });

  it('gerar de novo substitui o orçamento em vez de duplicar', async () => {
    const a = await CopilotService.draft({ name: 'Ana', phone: '', text: '2 lápis\n1 borracha' }, { ai });
    const b = await CopilotService.draft({ name: 'Ana', phone: '', text: '3 lápis\n1 borracha', replaceId: a.quoteRequestId }, { ai });
    expect(b.quoteRequestId).toBe(a.quoteRequestId);
    expect(await prisma.quoteRequest.count()).toBe(1);
    expect(b.total).toBe(9.3);
  });

  it('parece lista mas nenhum item foi reconhecido: responde como mensagem comum, sem "vou conferir" vazio', async () => {
    const r = await CopilotService.draft({ name: 'Ana', phone: '', text: 'Olá! Vim pelo site e quero um orçamento para retirar na loja:\n\nObrigado!\n#ORC-SITE v1' }, { ai });
    expect(r.reply).not.toMatch(/conferir esses itens:?\s*$/);
    expect(r.intent).toBe('other');
    expect(await prisma.quoteRequest.count()).toBe(0);
  });
});
