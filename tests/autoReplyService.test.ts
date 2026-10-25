import { describe, beforeEach, it, expect } from 'vitest';
import { AutoReplyService } from '../src/services/autoReplyService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

// sexta 23/10/2026, 10h e 20h em Brasília
const OPEN = new Date('2026-10-23T10:00:00-03:00');
const CLOSED = new Date('2026-10-23T20:00:00-03:00');
const ai = async () => 'Oi, Ana! Que bom falar com você 😊';

describe('AutoReplyService.decide', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { waAutoEnabled: true, companyName: 'Laçolaria', storeHours: 'Seg a sex 8h às 18h' },
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
    expect(await AutoReplyService.status(OPEN)).toEqual({ enabled: true, inHours: true, maxPerHour: 20 });
    expect(await AutoReplyService.status(CLOSED)).toMatchObject({ inHours: false });
  });
});
