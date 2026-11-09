import { describe, beforeEach, it, expect } from 'vitest';
import { AutoReplyService } from '../src/services/autoReplyService';
import type { Complete } from '../src/services/agentService';
import { NOT_A_LIST } from '../src/services/schoolListService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

// sexta 23/10/2026, 10h e 20h em Brasília
const OPEN = new Date('2026-10-23T10:00:00-03:00');
const CLOSED = new Date('2026-10-23T20:00:00-03:00');
const ai = async () => 'Oi, Ana! Que bom falar com você 😊';

describe('AutoReplyService.decide com foto', () => {
  const FOTO = 'data:image/jpeg;base64,AAAA';
  const noModel = async () => ({ content: '', toolCalls: [] });

  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { waAutoEnabled: true, companyName: 'Laçolaria' },
      create: { id: 'app', waAutoEnabled: true, companyName: 'Laçolaria' },
    });
    const cat = await prisma.category.create({ data: { name: 'Escolar' } });
    await prisma.product.create({ data: { name: 'Lápis HB', sku: 'ALAP', categoryId: cat.id, salePrice: 2.5, stockQuantity: 50 } });
  });

  it('foto de lista: a IA recebe o que foi lido e o orçamento sai', async () => {
    let seen = '';
    const complete: Complete = async (messages) => {
      if (messages.some((m) => m.role === 'tool')) return { content: 'Oi! Segue o orçamento:', toolCalls: [] };
      seen = String(messages[1].content);
      return { content: '', toolCalls: [{ id: 'a', type: 'function', function: { name: 'montar_orcamento', arguments: JSON.stringify({ itens: '2 lápis hb\n1 borracha' }) } }] };
    };
    const r = await AutoReplyService.decide(
      { name: 'Ana', phone: '', text: '', images: [FOTO], history: [{ from: 'cliente', text: 'Boa tarde' }] },
      { complete, readPhoto: async () => '2 lápis hb\n1 borracha', now: OPEN },
    );
    expect(r).toMatchObject({ action: 'send', intent: 'list' });
    expect(seen).toContain('2 lápis hb');
    const ev = await prisma.agentEvent.findFirstOrThrow();
    expect(ev.customerText).toContain('[1 foto]');
  });

  describe('comprovante do Ciranda', () => {
    const APM = 'COMPROVANTE\nR$ 180,00\n09/11/2026\nAna Souza\nAssociação de Pais e Mestres, CNPJ 10.352.702/0001-98';
    const ANA = { name: 'Ana', phone: '5517999998888' };
    const registra: Complete = async (messages) =>
      messages.some((m) => m.role === 'tool')
        ? { content: 'ok', toolCalls: [] }
        : { content: '', toolCalls: [{ id: 'a', type: 'function', function: { name: 'registrar_dados_ciranda', arguments: JSON.stringify({ crianca: 'João', ano: 'Infantil 4', responsavel: 'Ana Souza' }) } }] };

    it('sem legenda: salva, pede os dados sem chamar a IA; depois os dados completam', async () => {
      const r = await AutoReplyService.decide({ ...ANA, text: '', images: [FOTO] }, { complete: noModel, readPhoto: async () => APM, now: OPEN });
      expect(r).toMatchObject({ action: 'send', reply: expect.stringMatching(/nome da criança/) });
      expect((await prisma.cirandaPayment.findFirstOrThrow()).receiptInfo).toContain('180,00');

      const d = await AutoReplyService.decide({ ...ANA, text: 'João\nInfantil 4\nAna Souza' }, { complete: registra, now: OPEN });
      expect(d).toMatchObject({ action: 'send', reply: expect.stringMatching(/Prontinho.*João \(Infantil 4\)/) });
      expect(await prisma.cirandaPayment.findFirstOrThrow()).toMatchObject({ childName: 'João', guardianName: 'Ana Souza', hasReceipt: true });
    });

    it('com legenda: os dados vêm junto', async () => {
      const r = await AutoReplyService.decide({ ...ANA, text: 'João, infantil 4, mãe Ana Souza', images: [FOTO] }, { complete: registra, readPhoto: async () => APM, now: OPEN });
      expect(r).toMatchObject({ action: 'send', reply: expect.stringMatching(/Prontinho/) });
      expect(await prisma.cirandaPayment.count()).toBe(1);
    });

    it('comprovante para outro recebedor vai para o atendente e não entra no relatório', async () => {
      const r = await AutoReplyService.decide(
        { ...ANA, text: '', images: [FOTO] },
        { complete: noModel, readPhoto: async () => 'COMPROVANTE\nR$ 50\nRecebedor: Laçolaria', now: OPEN },
      );
      expect(r).toMatchObject({ action: 'human', reason: expect.stringMatching(/comprovante/) });
      expect(await prisma.cirandaPayment.count()).toBe(0);
    });
  });

  it('foto que não é lista vai para o atendente', async () => {
    const r = await AutoReplyService.decide({ name: 'Ana', phone: '', text: '', images: [FOTO] }, { complete: noModel, readPhoto: async () => NOT_A_LIST, now: OPEN });
    expect(r).toMatchObject({ action: 'human', reason: expect.stringMatching(/não é lista/) });
  });

  it('erro ao ler a foto vai para o atendente', async () => {
    const r = await AutoReplyService.decide(
      { name: 'Ana', phone: '', text: '', images: [FOTO] },
      { complete: noModel, readPhoto: async () => { throw new Error('caiu'); }, now: OPEN },
    );
    expect(r).toMatchObject({ action: 'human', reason: expect.stringMatching(/não consegui ler a foto/i) });
  });
});

describe('AutoReplyService.decide', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { waAutoEnabled: true, waWinbackEnabled: false, waWinbackPerDay: 8, companyName: 'Laçolaria', storeHours: 'Seg a sex 8h às 18h' },
      create: { id: 'app', waAutoEnabled: true, companyName: 'Laçolaria', storeHours: 'Seg a sex 8h às 18h' },
    });
    const cat = await prisma.category.create({ data: { name: 'Escolar' } });
    await prisma.product.create({ data: { name: 'Lápis HB', sku: 'ALAP', categoryId: cat.id, salePrice: 2.5, stockQuantity: 50 } });
  });

  it('desligada: não responde', async () => {
    await prisma.settings.update({ where: { id: 'app' }, data: { waAutoEnabled: false } });
    expect(await AutoReplyService.decide({ name: 'Ana', phone: '', text: '2 lápis hb\n1 borracha' }, { ai, now: OPEN })).toMatchObject({ action: 'off' });
  });

  it('fora do horário: espera', async () => {
    expect(await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'Que horas abre?' }, { ai, now: CLOSED })).toMatchObject({ action: 'wait' });
  });

  it('lista de material: responde com o orçamento e salva em Orçamentos pedidos', async () => {
    const r = await AutoReplyService.decide({ name: 'Ana', phone: '5517999998888', text: '2 lápis hb\n1 borracha' }, { ai, now: OPEN });
    expect(r.action).toBe('send');
    if (r.action !== 'send') return;
    expect(r.reply).toMatch(/Lápis HB/);
    expect(r.quoteRequestId).toBeTruthy();
    expect(await prisma.quoteRequest.count()).toBe(1);
  });

  it('"tem X?": achou no estoque responde; não achou passa para o atendente conferir', async () => {
    const found = await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'Vocês têm lápis hb?' }, { ai, now: OPEN });
    expect(found).toMatchObject({ action: 'send', intent: 'product' });
    const none = await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'Tem caneta de unicórnio dourada?' }, { ai, now: OPEN });
    expect(none).toMatchObject({ action: 'human', reason: expect.stringMatching(/estoque/) });
  });

  it('IA fora do ar ou sem chave: não manda texto pronto, passa para o atendente', async () => {
    const down = async () => {
      throw new Error('sem chave da NVIDIA');
    };
    expect(await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'Vocês aceitam pix?' }, { ai: down, now: OPEN })).toMatchObject({
      action: 'human',
      reason: expect.stringMatching(/IA/),
    });
  });

  it('pergunta simples: responde; assunto delicado ou outro: passa para o atendente sem salvar nada', async () => {
    expect(await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'Que horas vocês fecham hoje?' }, { ai, now: OPEN })).toMatchObject({ action: 'send' });
    const t = await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'O caderno veio com defeito, quero trocar' }, { ai, now: OPEN });
    expect(t).toMatchObject({ action: 'human', reason: expect.stringMatching(/delicado/) });
    expect(await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'Preciso falar com a dona sobre a festa' }, { ai, now: OPEN })).toMatchObject({ action: 'human' });
    expect(await prisma.quoteRequest.count()).toBe(0);
  });

  it('status: ligada, no horário e o limite por hora', async () => {
    expect(await AutoReplyService.status(OPEN)).toEqual({ enabled: true, inHours: true, maxPerHour: 20, winbackEnabled: false, winbackPerDay: 8 });
    expect(await AutoReplyService.status(CLOSED)).toMatchObject({ inHours: false });
  });
});
