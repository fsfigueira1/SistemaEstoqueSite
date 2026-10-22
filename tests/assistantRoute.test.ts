import { describe, beforeEach, it, expect } from 'vitest';
import { POST } from '../src/app/api/assistant/route';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

const req = (body: unknown, type = 'application/json') =>
  new Request('http://x/api/assistant', { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) });

describe('POST /api/assistant', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({ where: { id: 'app' }, update: { nvidiaApiKey: '' }, create: { id: 'app' } });
  });

  it('rota sem chave dá 400 com texto para a dona', async () => {
    const r = await POST(req({ messages: [{ role: 'user', content: 'quanto vendi hoje?' }] }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('Cadastre a chave da NVIDIA em Configurações para usar o ajudante');
  });

  it('conversa inválida dá 400 e não-JSON dá 415', async () => {
    expect((await POST(req({ messages: [] }))).status).toBe(400);
    expect((await POST(req({ messages: [{ role: 'user', content: 'oi' }] }, 'text/plain'))).status).toBe(415);
  });
});
