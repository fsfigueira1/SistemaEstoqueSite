import { describe, beforeEach, it, expect } from 'vitest';
import { CopilotExampleService } from '../src/services/copilotExampleService';
import { CopilotService } from '../src/services/copilotService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

describe('CopilotExampleService', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({ where: { id: 'app' }, update: { copilotPersona: '' }, create: { id: 'app' } });
  });

  it('record ignora vazio e repetido', async () => {
    await CopilotExampleService.record({ customerText: 'oi', aiReply: 'Oi!', finalReply: 'Oi, tudo bem? 😊' });
    await CopilotExampleService.record({ customerText: 'oi', aiReply: 'Oi!', finalReply: 'Oi, tudo bem? 😊' });
    await CopilotExampleService.record({ customerText: 'oi', aiReply: 'Oi!', finalReply: '   ' });
    const saved = await CopilotExampleService.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].finalReply).toBe('Oi, tudo bem? 😊'); // emoji volta intacto do banco
  });

  it('lista os mais recentes primeiro e remove', async () => {
    await CopilotExampleService.record({ customerText: 'a', aiReply: '', finalReply: 'primeira' });
    await CopilotExampleService.record({ customerText: 'b', aiReply: '', finalReply: 'segunda' });
    const list = await CopilotExampleService.list();
    expect(list.map((e) => e.finalReply)).toEqual(['segunda', 'primeira']);
    await CopilotExampleService.remove(list[0].id);
    expect((await CopilotExampleService.list()).map((e) => e.finalReply)).toEqual(['primeira']);
  });

  it('copiloto manda persona e exemplos para a IA', async () => {
    await CopilotExampleService.record({ customerText: 'tem mochila?', aiReply: '', finalReply: 'Temos simmm! Vem ver de pertinho, você vai amar 🎀' });
    const prompts: string[] = [];
    const ai = async (system: string) => {
      prompts.push(system);
      return 'Oi, Bia! Que bom te ver por aqui ✨';
    };
    await CopilotService.draft({ name: 'Bia', phone: '', text: 'vocês abrem sábado?' }, { ai });
    expect(prompts[0]).toMatch(/carism/i);
    expect(prompts[0]).toContain('Temos simmm! Vem ver de pertinho');
    await prisma.settings.update({ where: { id: 'app' }, data: { copilotPersona: 'Fale de forma bem formal.' } });
    await CopilotService.draft({ name: 'Bia', phone: '', text: 'e domingo?' }, { ai });
    expect(prompts[1]).toContain('Fale de forma bem formal.');
  });
});
