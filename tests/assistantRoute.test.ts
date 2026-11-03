import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { POST } from '../src/app/api/assistant/route';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

const req = (body: unknown, type = 'application/json') =>
  new Request('http://x/api/assistant', { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) });

describe('POST /api/assistant', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({ where: { id: 'app' }, update: { nvidiaApiKey: '', geminiApiKey: '', aiProvider: 'nvidia' }, create: { id: 'app' } });
  });

  it('rota sem chave dá 400 com texto para a dona', async () => {
    const r = await POST(req({ messages: [{ role: 'user', content: 'quanto vendi hoje?' }] }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('Cadastre a chave da NVIDIA ou do Gemini em Configurações → Inteligência artificial');
  });

  it('conversa inválida dá 400 e não-JSON dá 415', async () => {
    expect((await POST(req({ messages: [] }))).status).toBe(400);
    expect((await POST(req({ messages: [{ role: 'user', content: 'oi' }] }, 'text/plain'))).status).toBe(415);
  });

  afterEach(() => vi.restoreAllMocks());

  it('chave inválida vira mensagem clara para a dona', async () => {
    await prisma.settings.update({ where: { id: 'app' }, data: { nvidiaApiKey: '<nvapi-errada>' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }));
    const r = await POST(req({ messages: [{ role: 'user', content: 'quanto vendi?' }] }));
    expect(r.status).toBe(502);
    expect((await r.json()).error).toBe('Chave da IA inválida — confira em Configurações');
  });

  it('limite da NVIDIA vira mensagem clara', async () => {
    await prisma.settings.update({ where: { id: 'app' }, data: { nvidiaApiKey: '<nvapi-ok>' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));
    const r = await POST(req({ messages: [{ role: 'user', content: 'quanto vendi?' }] }));
    expect((await r.json()).error).toBe('Limite de uso da IA atingido — tente de novo em alguns minutos');
  });

  it('NVIDIA no limite e Gemini cadastrado: o Gemini responde', async () => {
    await prisma.settings.update({ where: { id: 'app' }, data: { nvidiaApiKey: '<nvapi-ok>', geminiApiKey: '<AIza-ok>' } });
    const sse = 'data: {"choices":[{"delta":{"content":"Vendeu R$ 10"}}]}\n\ndata: [DONE]\n\n';
    const f = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response(sse, { headers: { 'content-type': 'text/event-stream' } }));
    const r = await POST(req({ messages: [{ role: 'user', content: 'quanto vendi?' }] }));
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('Vendeu R$ 10');
    expect(String(f.mock.calls[1][0])).toContain('generativelanguage.googleapis.com');
  });
});
