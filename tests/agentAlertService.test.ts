import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';
import { AgentAlertService } from '../src/services/agentAlertService';

const NOW = new Date('2026-11-03T15:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

type Ev = { kind: string; name?: string; phone?: string; status?: string; at: Date; sentAt?: Date; reason?: string };
async function ev({ at, ...rest }: Ev) {
  return prisma.agentEvent.create({
    data: { name: 'Ana Souza', phone: '5511999990001', customerText: 'tem caderno?', reply: 'temos sim!', ...rest, createdAt: at },
  });
}

describe('avisos da assistente', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('pediu atendente (até 24 h) vem primeiro; parou de responder (2 h a 3 dias) depois', async () => {
    await ev({ kind: 'reply', status: 'enviada', phone: '5511000000001', name: 'Bia', at: ago(5), sentAt: ago(5) });
    await ev({ kind: 'handoff', phone: '5511000000002', name: 'Caio', reason: 'troca de produto', at: ago(1) });
    const list = await AgentAlertService.list(NOW);
    expect(list.map((a) => [a.type, a.name])).toEqual([
      ['atendente', 'Caio'],
      ['parou', 'Bia'],
    ]);
    expect(list[0].reason).toBe('troca de produto');
    expect(list[1].reason).toBe('parou de responder depois da resposta');
  });

  it('respondeu há menos de 2 h, mais de 3 dias, não foi enviada ou handoff velho: sem aviso', async () => {
    await ev({ kind: 'reply', status: 'enviada', phone: '1', at: ago(1), sentAt: ago(1) });
    await ev({ kind: 'reply', status: 'enviada', phone: '2', at: ago(80), sentAt: ago(80) });
    await ev({ kind: 'reply', status: 'pronta', phone: '3', at: ago(5) });
    await ev({ kind: 'handoff', phone: '4', at: ago(30) });
    expect(await AgentAlertService.list(NOW)).toEqual([]);
  });

  it('vale o último acontecimento do cliente (a IA respondeu depois do handoff)', async () => {
    await ev({ kind: 'handoff', at: ago(4) });
    await ev({ kind: 'reply', status: 'enviada', at: ago(1), sentAt: ago(1) });
    expect(await AgentAlertService.list(NOW)).toEqual([]);
  });

  it('visto tira para todo mundo; marcar de novo não faz nada', async () => {
    const e = await ev({ kind: 'handoff', at: ago(1) });
    expect(await AgentAlertService.markSeen(e.id)).toBe(true);
    expect(await AgentAlertService.markSeen(e.id)).toBe(false);
    expect(await AgentAlertService.list(NOW)).toEqual([]);
  });

  it('robô registra o que passou para a loja, com telefone só em números', async () => {
    const id = await AgentAlertService.logHandoff({ name: 'Dani', phone: '+55 (11) 98888-7777', reason: 'mandou áudio' });
    const e = await prisma.agentEvent.findUniqueOrThrow({ where: { id } });
    expect(e).toMatchObject({ kind: 'handoff', phone: '5511988887777', reason: 'mandou áudio' });
  });

  it('sugestão: mensagem curta sem preço; com preço é recusada', async () => {
    const e = await ev({ kind: 'reply', status: 'enviada', at: ago(5), sentAt: ago(5) });
    const ok = 'Oi Ana! Conseguiu ver o caderno? 😊';
    expect(await AgentAlertService.suggest(e.id, { ai: async () => ok })).toBe(ok);
    await expect(AgentAlertService.suggest(e.id, { ai: async () => 'Oi Ana, o caderno sai R$ 25,90' })).rejects.toThrow('não conseguiu sugerir');
    await expect(AgentAlertService.suggest('nao-existe', { ai: async () => 'x' })).rejects.toThrow('não encontrado');
  });
});
