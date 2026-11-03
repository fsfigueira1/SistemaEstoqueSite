import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { authSecret, signToken, verifyToken, type Role } from '@/lib/authToken';
import { resetAuthStamps, sessionKey } from '@/lib/authStamp';
import { POST as login } from '@/app/api/senha/route';
import { AuthService } from '@/services/authService';
import { prisma } from './setup';

const badge = async (role: Role, ms = 60_000) => `erp_auth=${await signToken(await sessionKey(role), role, Date.now() + ms)}`;
const go = async (path: string, init: { cookie?: string; method?: string; headers?: Record<string, string> } = {}) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? 'GET', headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers } }));

describe('proxy: login e perfis', () => {
  beforeEach(async () => {
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { authOwnerUser: '', authOwnerHash: '', authEmployeeUser: '', authEmployeeHash: '' },
      create: { id: 'app' },
    });
    resetAuthStamps();
    process.env.OWNER_PASSWORD = 'owner123';
    process.env.EMPLOYEE_PASSWORD = 'emp123';
  });

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
    const s = await verifyToken(await sessionKey('EMPLOYEE'), renewed);
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

  it('trocou a senha do balcão: o crachá antigo cai na hora; o do dono continua', async () => {
    const old = await badge('EMPLOYEE');
    const owner = await badge('OWNER');
    expect((await go('/pdv', { cookie: old })).status).toBe(200);
    await AuthService.change({ role: 'EMPLOYEE', password: 'senha-nova-1', ownerPassword: 'owner123' });
    expect((await go('/api/sales', { cookie: old })).status).toBe(401);
    expect((await go('/api/sales', { cookie: owner })).status).toBe(200);
    expect((await go('/api/sales', { cookie: await badge('EMPLOYEE') })).status).toBe(200);
  });

  it('crachá assinado só com o segredo (sem a senha) não vale para dono/balcão; robô vale', async () => {
    const plain = async (role: Role) => `erp_auth=${await signToken(await authSecret(), role, Date.now() + 60_000)}`;
    await AuthService.change({ role: 'OWNER', password: 'outra-senha', ownerPassword: 'owner123' });
    expect((await go('/api/dashboard/stats', { cookie: await plain('OWNER') })).status).toBe(401);
    expect((await go('/api/copilot/auto', { method: 'POST', cookie: await plain('ROBOT') })).status).toBe(200);
  });
});

describe('freio de chute de senha', () => {
  const tryLogin = (user: string, password: string, ip: string) =>
    login(new Request('http://x/api/senha', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ user, password }) }));

  beforeEach(async () => {
    await prisma.settings.update({ where: { id: 'app' }, data: { authEmployeeUser: '', authEmployeeHash: '' } });
    resetAuthStamps();
    process.env.EMPLOYEE_PASSWORD = 'emp123';
  });

  it('5 erros no mesmo usuário travam, mesmo trocando o endereço a cada tentativa', async () => {
    for (let i = 0; i < 5; i++) expect((await tryLogin('caixa-freio', 'errada', `10.0.0.${i}`)).status).toBe(401);
    expect((await tryLogin('caixa-freio', 'errada', '10.0.0.99')).status).toBe(429);
  });

  it('várias tentativas ao mesmo tempo não passam do limite', async () => {
    const all = await Promise.all(Array.from({ length: 12 }, (_, i) => tryLogin('caixa-paralelo', 'errada', `10.1.0.${i}`)));
    expect(all.filter((r) => r.status === 401).length).toBeLessThanOrEqual(5);
    expect(all.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(7);
  });

  it('acerto zera a contagem e devolve o crachá', async () => {
    for (let i = 0; i < 3; i++) await tryLogin('balcao', 'errada', '10.2.0.1');
    const ok = await tryLogin('balcao', 'emp123', '10.2.0.1');
    expect(ok.status).toBe(200);
    const token = ok.headers.get('set-cookie')?.match(/erp_auth=([^;]+)/)?.[1];
    expect((await verifyToken(await sessionKey('EMPLOYEE'), token))?.role).toBe('EMPLOYEE');
  });
});
