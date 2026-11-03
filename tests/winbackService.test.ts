import { describe, beforeEach, it, expect } from 'vitest';
import { WinbackService } from '../src/services/winbackService';
import { AgentEventService } from '../src/services/agentEventService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

// sexta 23/10/2026, 10h em Brasília
const NOW = new Date('2026-10-23T10:00:00-03:00');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const ai = async () => 'Oi, Fernanda! Faz um tempinho que você não aparece. Se precisar de material, manda a lista por aqui 😊';

async function quote(name: string, phone: string, at: Date, title = 'sua lista') {
  await prisma.quoteRequest.create({ data: { name, phone, title, items: [], createdAt: at } });
}

describe('WinbackService (chamar de volta)', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { waWinbackEnabled: true, waWinbackDays: 60, waWinbackPerDay: 2, companyName: 'Laçolaria' },
      create: { id: 'app', waWinbackEnabled: true, waWinbackDays: 60, waWinbackPerDay: 2, companyName: 'Laçolaria' },
    });
  });

  it('só entra quem sumiu há mais tempo que o configurado; quem pediu SAIR fica de fora', async () => {
    await quote('Fernanda Rocha', '17999990001', daysAgo(200));
    await quote('Vinícius Teixeira', '17999990002', daysAgo(10));
    await quote('Patrícia Oliveira', '17999990003', daysAgo(120));
    await prisma.contact.create({ data: { phone: '5517999990003', optOutAt: daysAgo(5) } });
    const c = await WinbackService.candidates(NOW);
    expect(c.map((x) => x.name)).toEqual(['Fernanda Rocha']);
    expect(c[0].phone).toBe('5517999990001');
  });

  it('next: mensagem única com a linha do SAIR, registrada; a mesma pessoa não recebe de novo', async () => {
    await quote('Fernanda Rocha', '17999990001', daysAgo(200));
    const n = await WinbackService.next({ now: NOW, ai });
    expect(n).toMatchObject({ name: 'Fernanda Rocha', phone: '5517999990001' });
    expect(n?.text).toMatch(/^Oi, Fernanda!/);
    expect(n?.text).toMatch(/responder SAIR\.$/);
    expect(await WinbackService.next({ now: NOW, ai })).toBeNull();
  });

  it('respeita o limite por dia, o horário e o desligado', async () => {
    for (let i = 1; i <= 4; i++) await quote(`Cliente ${i}`, `1799999000${i}`, daysAgo(100 + i));
    expect(await WinbackService.next({ now: NOW, ai })).not.toBeNull();
    expect(await WinbackService.next({ now: NOW, ai })).not.toBeNull();
    expect(await WinbackService.next({ now: NOW, ai })).toBeNull(); // limite de 2
    expect(await WinbackService.next({ now: new Date('2026-10-23T21:00:00-03:00'), ai })).toBeNull(); // fora do horário
    await prisma.settings.update({ where: { id: 'app' }, data: { waWinbackEnabled: false } });
    expect(await WinbackService.next({ now: new Date('2026-10-26T10:00:00-03:00'), ai })).toBeNull();
  });

  it('IA que escreve preço ou promoção: não manda nada', async () => {
    await quote('Fernanda Rocha', '17999990001', daysAgo(200));
    expect(await WinbackService.next({ now: NOW, ai: async () => 'Oi! Cadernos a R$ 9,90 só hoje!' })).toBeNull();
    expect(await prisma.agentEvent.count()).toBe(0);
  });

  it('quadro: mostra quem respondeu depois da mensagem', async () => {
    await quote('Fernanda Rocha', '17999990001', daysAgo(200));
    const n = await WinbackService.next({ now: NOW, ai });
    if (!n) throw new Error('devia ter mensagem');
    await AgentEventService.mark(n.eventId, 'enviada');
    // o registro usa o relógio de verdade; a resposta vem 1 h depois dele
    const sent = (await prisma.agentEvent.findUniqueOrThrow({ where: { id: n.eventId } })).createdAt;
    await prisma.agentEvent.create({ data: { kind: 'reply', name: 'Fernanda Rocha', phone: '5517999990001', status: 'enviada', createdAt: new Date(sent.getTime() + 3_600_000) } });
    // "hoje" = logo depois do envio (somar horas pode virar o dia perto da meia-noite)
    const b = await WinbackService.board(new Date(sent.getTime() + 60_000));
    expect(b.cards[0]).toMatchObject({ name: 'Fernanda Rocha', outcome: 'respondeu' });
    expect(b.sentToday).toBe(1);
  });
});
