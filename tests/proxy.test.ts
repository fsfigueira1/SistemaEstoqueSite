import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { authSecret, signToken, verifyToken, type Role } from '@/lib/authToken';

const badge = async (role: Role, ms = 60_000) => `erp_auth=${await signToken(await authSecret(), role, Date.now() + ms)}`;
const go = async (path: string, init: { cookie?: string; method?: string; headers?: Record<string, string> } = {}) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? 'GET', headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers } }));

describe('proxy: login e perfis', () => {
  it('sem login: página vai para /senha guardando o destino; API dá 401', async () => {
    const r = await go('/estoque?x=1');
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('http://localhost:3000/senha?redirect=%2Festoque%3Fx%3D1');
    expect((await go('/api/sales')).status).toBe(401);
    expect((await go('/')).headers.get('location')).toBe('http://localhost:3000/senha');
  });

  it('crachá vencido, adulterado ou do PIN antigo não entra', async () => {
    expect((await go('/api/sales', { cookie: await badge('OWNER', -1) })).status).toBe(401);
    const forged = (await badge('EMPLOYEE')).replace('EMPLOYEE', 'OWNER');
    expect((await go('/api/dashboard/stats', { cookie: forged })).status).toBe(401);
    expect((await go('/api/sales', { cookie: 'erp_auth=OWNER:1' })).status).toBe(401);
  });

  it('dono abre tudo; "/" e /senha levam ao painel', async () => {
    const cookie = await badge('OWNER');
    expect((await go('/api/dashboard/stats', { cookie })).status).toBe(200);
    expect((await go('/', { cookie })).headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect((await go('/senha', { cookie })).headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('balcão: PDV abre; painel volta para o PDV; faturamento pela API dá 403', async () => {
    const cookie = await badge('EMPLOYEE');
    expect((await go('/pdv', { cookie })).status).toBe(200);
    expect((await go('/dashboard', { cookie })).headers.get('location')).toBe('http://localhost:3000/pdv');
    expect((await go('/api/dashboard/stats', { cookie })).status).toBe(403);
  });

  it('ninguém escolhe o perfil pelo cabeçalho de fora', async () => {
    const r = await go('/api/sales', { cookie: await badge('EMPLOYEE'), headers: { 'x-erp-role': 'OWNER' } });
    expect(r.headers.get('x-middleware-request-x-erp-role')).toBe('EMPLOYEE');
    expect((await go('/api/dashboard/stats', { cookie: await badge('EMPLOYEE'), headers: { 'x-erp-role': 'OWNER' } })).status).toBe(403);
  });

  it('cada uso renova a sessão (o robô não ganha cookie)', async () => {
    const r = await go('/pdv', { cookie: await badge('EMPLOYEE', 60_000) });
    const renewed = r.cookies.get('erp_auth')?.value;
    const s = await verifyToken(await authSecret(), renewed);
    expect(s?.role).toBe('EMPLOYEE');
    expect(s?.expiresAt).toBeGreaterThan(Date.now() + 9 * 3600_000);
    const robot = await go('/api/copilot/auto', { method: 'POST', cookie: await badge('ROBOT') });
    expect(robot.status).toBe(200);
    expect(robot.cookies.get('erp_auth')).toBeUndefined();
  });

  it('login e logout são públicos', async () => {
    expect((await go('/senha')).status).toBe(200);
    expect((await go('/api/senha', { method: 'POST' })).status).toBe(200);
  });
});
