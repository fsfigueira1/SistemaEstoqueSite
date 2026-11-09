import { describe, beforeEach, it, expect } from 'vitest';
import { AutoReplyService } from '../src/services/autoReplyService';
import { AgentService, type Complete } from '../src/services/agentService';
import { AgentEventService } from '../src/services/agentEventService';
import { AgentDashboardService } from '../src/services/agentDashboardService';
import type { NvToolCall } from '../src/lib/nvidia';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

// sexta 23/10/2026, 10h em Brasília
const OPEN = new Date('2026-10-23T10:00:00-03:00');
const ai = async () => 'Oi, Ana! Que bom falar com você 😊';

const tool = (name: string, args: Record<string, string>): NvToolCall => ({ id: `c_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });

/** IA de mentira: cada volta devolve o próximo passo do roteiro; guarda o que recebeu. */
function script(...turns: Array<{ content?: string; tools?: NvToolCall[] }>) {
  const seen: Parameters<Complete>[0][] = [];
  let i = 0;
  const complete: Complete = async (messages) => {
    seen.push(structuredClone(messages));
    const t = turns[Math.min(i++, turns.length - 1)];
    return { content: t.content ?? '', toolCalls: t.tools ?? [] };
  };
  return { complete, seen };
}

describe('AgentService (Nemotron com ferramentas)', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { waAutoEnabled: true, companyName: 'Laçolaria', storeHours: 'Seg a sex 8h às 18h' },
      create: { id: 'app', waAutoEnabled: true, companyName: 'Laçolaria', storeHours: 'Seg a sex 8h às 18h' },
    });
    const cat = await prisma.category.create({ data: { name: 'Escolar' } });
    await prisma.product.create({ data: { name: 'Lápis HB', sku: 'ALAP', categoryId: cat.id, salePrice: 2.5, stockQuantity: 50 } });
    await prisma.product.create({ data: { name: 'Borracha branca', sku: 'ABOR', categoryId: cat.id, salePrice: 1.5, stockQuantity: 0 } });
  });

  it('"tem lápis?": busca no estoque e o preço vem do cadastro, não da IA', async () => {
    const { complete } = script({ tools: [tool('buscar_produtos', { consulta: 'lápis hb' })] }, { content: 'Oi, Ana! Temos sim 😊' });
    const r = await AgentService.run({ name: 'Ana Souza', phone: '5517999998888', text: 'Vocês têm lápis HB?' }, { complete, now: OPEN });
    expect(r).toMatchObject({ action: 'send', mode: 'agente', intent: 'product' });
    expect(r.reply).toMatch(/^Oi, Ana! Temos sim/);
    expect(r.reply).toMatch(/Lápis HB — R\$\s?2,50/);
    expect(r.steps).toEqual(['lendo a conversa', 'buscando "lápis hb" no estoque', 'resposta pronta']);
  });

  it('lista de material: monta o orçamento pelo sistema e salva em Orçamentos pedidos', async () => {
    const { complete } = script({ tools: [tool('montar_orcamento', { itens: '2 lápis hb\n1 borracha' })] }, { content: 'Oi, Ana! Segue o orçamento da sua lista:' });
    const r = await AgentService.run({ name: 'Ana', phone: '5517999998888', text: '2 lápis hb\n1 borracha' }, { complete, now: OPEN });
    expect(r).toMatchObject({ action: 'send', intent: 'list' });
    expect(r.reply).toMatch(/Lápis HB/);
    expect(r.quoteRequestId).toBeTruthy();
    expect(r.steps).toContain('salvo em Orçamentos');
    expect(await prisma.quoteRequest.count()).toBe(1);
  });

  describe('ver_lista_escolar', () => {
    const SOURCE = '*Colégio São José — 3º ano — 2027*\n\nTaxa: R$ 100,00\n• 2 borrachas';

    beforeEach(async () => {
      const school = await prisma.school.create({ data: { name: 'Colégio São José Agostiniano', slug: 'colegio-sao-jose-agostiniano' } });
      const lapis = await prisma.product.findFirstOrThrow({ where: { sku: 'ALAP' } });
      await prisma.schoolList.create({
        data: { schoolId: school.id, grade: '3º ano', schoolYear: 2027, code: 'L-3ANO', sourceText: SOURCE, items: { create: [{ position: 0, raw: '1 lápis', text: 'lápis', qty: 1, productId: lapis.id }] } },
      });
      await prisma.schoolList.create({ data: { schoolId: school.id, grade: 'Infantil 3', schoolYear: 2027, code: 'L-INF3', sourceText: 'Lista do Infantil 3' } });
    });

    const ask = async (args: Record<string, string>, opening = 'Oi, Ana! Aqui está a lista 😊', text = 'Qual a lista do terceiro ano?') => {
      const { complete, seen } = script({ tools: [tool('ver_lista_escolar', args)] }, { content: opening });
      const r = await AgentService.run({ name: 'Ana', phone: '', text }, { complete, now: OPEN });
      return { r, seen };
    };

    it('anexa o texto salvo da série e o código para pedir orçamento', async () => {
      const { r } = await ask({ serie: 'terceiro ano', escola: 'São José' });
      expect(r).toMatchObject({ action: 'send', mode: 'agente' });
      expect(r.reply).toMatch(/^Oi, Ana! Aqui está a lista/);
      expect(r.reply).toContain(SOURCE);
      expect(r.reply).toContain('#L-3ANO');
      expect(r.steps).toContain('consultando a lista "terceiro ano"');
    });

    it('lista sem produto ligado não oferece orçamento', async () => {
      const { r } = await ask({ serie: 'infantil 3' });
      expect(r.reply).toContain('Lista do Infantil 3');
      expect(r.reply).not.toContain('#L-INF3');
    });

    it('Infantil: script pronto, sem nenhuma frase da IA', async () => {
      const { r } = await ask({ serie: 'infantil 3' }, 'O Ciranda é com a equipe do colégio.');
      expect(r.action).toBe('send');
      expect(r.reply).toBe('Oi, Ana! Seguem as informações do Infantil 3:\n\nLista do Infantil 3');
    });

    it('série sem lista: a IA recebe as séries salvas e nada é anexado', async () => {
      const { r, seen } = await ask({ serie: '9º ano' }, 'Oi! Temos do Infantil 3 e do 3º ano.');
      expect(r.reply).toBe('Oi! Temos do Infantil 3 e do 3º ano.');
      expect(JSON.stringify(seen[1])).toContain('Séries com lista: 3º ano; Infantil 3');
    });

    it('escola sem lista não mostra a lista de outra escola', async () => {
      const { r } = await ask({ serie: '3º ano', escola: 'Objetivo' }, 'Essa escola ainda não temos, pode mandar a lista?');
      expect(r.reply).not.toContain(SOURCE);
    });

    it('abertura da IA com preço é trocada e a lista ainda vai', async () => {
      const { r } = await ask({ serie: '3º ano' }, 'A taxa é R$ 100,00');
      expect(r).toMatchObject({ action: 'send' });
      expect(r.reply).toMatch(/^Oi, Ana! Segue a lista:/);
      expect(r.reply).toContain(SOURCE);
    });

    it('pergunta em duas linhas não vai para o atendente como lista não orçada', async () => {
      const { r } = await ask({ serie: '3º ano' }, 'Aqui está!', 'Oi\nqual a lista do 3 ano\ndo são josé?');
      expect(r.action).toBe('send');
    });
  });

  it('chamar_atendente: passa para a loja e não responde', async () => {
    const { complete } = script({ tools: [tool('chamar_atendente', { motivo: 'quer encomendar 200 convites' })] });
    const r = await AgentService.run({ name: 'Ana', phone: '', text: 'Vocês fazem 200 convites de casamento personalizados?' }, { complete, now: OPEN });
    expect(r).toMatchObject({ action: 'human', reason: 'quer encomendar 200 convites' });
  });

  it('IA que escreve preço por conta própria não vai para o cliente', async () => {
    const { complete } = script({ content: 'Oi! O caderno custa R$ 25,90 😊' });
    const r = await AgentService.run({ name: 'Ana', phone: '', text: 'Quanto custa o caderno?' }, { complete, now: OPEN });
    expect(r.action).toBe('human');
  });

  it('produto que não achou: nunca diz "não temos", chama o atendente', async () => {
    const { complete } = script({ tools: [tool('buscar_produtos', { consulta: 'globo terrestre' })] }, { content: 'Vou conferir!' });
    const r = await AgentService.run({ name: 'Ana', phone: '', text: 'Tem globo terrestre?' }, { complete, now: OPEN });
    expect(r).toMatchObject({ action: 'human', reason: expect.stringMatching(/globo terrestre/) });
  });

  it('a IA recebe a conversa inteira, não só a última mensagem', async () => {
    const { complete, seen } = script({ content: 'Abrimos às 8h, Ana! Te esperamos 😊' });
    await AgentService.run(
      {
        name: 'Ana',
        phone: '',
        text: 'E amanhã abre?',
        history: [
          { from: 'cliente', text: 'Oi, tudo bem?' },
          { from: 'loja', text: 'Oi, Ana! Tudo ótimo, e você?' },
          { from: 'cliente', text: 'E amanhã abre?' },
        ],
      },
      { complete, now: OPEN },
    );
    const user = seen[0][1];
    expect(user.role).toBe('user');
    expect(String(user.content)).toMatch(/Loja: Oi, Ana! Tudo ótimo/);
    expect(String(user.content)).toMatch(/Cliente: E amanhã abre\?$/m);
  });

  it('NVIDIA sem ferramentas/fora do ar: volta para o copiloto simples', async () => {
    const complete: Complete = async () => {
      throw new Error('IA da NVIDIA respondeu 400: tools not supported');
    };
    const r = await AgentService.run({ name: 'Ana', phone: '', text: '2 lápis hb\n1 borracha' }, { complete, ai, now: OPEN });
    expect(r).toMatchObject({ action: 'send', mode: 'simples' });
    expect(r.reply).toMatch(/Lápis HB/);
  });
});

describe('AutoReplyService + registro do agente', () => {
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

  it('resposta do agente fica registrada e conta no painel quando o robô confirma o envio', async () => {
    const { complete } = script({ tools: [tool('buscar_produtos', { consulta: 'lápis hb' })] }, { content: 'Temos sim, Ana 😊' });
    const r = await AutoReplyService.decide({ name: 'Ana', phone: '5517999998888', text: 'tem lápis hb?' }, { complete, now: OPEN });
    expect(r.action).toBe('send');
    if (r.action !== 'send') return;
    let today = await AgentDashboardService.today(OPEN);
    expect(today.ai.replies).toBe(0); // ainda não saiu
    expect(today.recent[0]).toMatchObject({ kind: 'reply', name: 'Ana', status: 'pronta' });
    expect(await AgentEventService.mark(r.eventId, 'enviada')).toBe(true);
    expect(await AgentEventService.mark(r.eventId, 'falhou')).toBe(false); // não volta atrás
    today = await AgentDashboardService.today(OPEN);
    expect(today.ai.replies).toBe(1);
    expect(today.recent[0].steps).toContain('buscando "lápis hb" no estoque');
  });

  it('passou para o atendente: registra o motivo', async () => {
    const r = await AutoReplyService.decide({ name: 'Ana', phone: '', text: 'O caderno veio com defeito' }, { now: OPEN });
    expect(r).toMatchObject({ action: 'human' });
    const ev = await prisma.agentEvent.findFirst();
    expect(ev).toMatchObject({ kind: 'handoff', reason: expect.stringMatching(/delicado/) });
  });

  it('"SAIR": marca o contato e confirma, sem passar pela IA', async () => {
    const complete: Complete = async () => {
      throw new Error('não devia chamar a IA');
    };
    const r = await AutoReplyService.decide({ name: 'Ana', phone: '5517999998888', text: 'SAIR' }, { complete, now: OPEN });
    expect(r).toMatchObject({ action: 'send', reply: expect.stringMatching(/Não vou mais te mandar/) });
    const c = await prisma.contact.findUnique({ where: { phone: '5517999998888' } });
    expect(c?.optOutAt).toBeTruthy();
  });
});
