import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';
import { AuthService, normUser } from '../src/services/authService';

const env = { ...process.env };

describe('login com usuário e senha', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await prisma.settings.upsert({
      where: { id: 'app' },
      update: { authOwnerUser: '', authOwnerHash: '', authEmployeeUser: '', authEmployeeHash: '' },
      create: { id: 'app' },
    });
    process.env.OWNER_PASSWORD = 'owner123';
    process.env.EMPLOYEE_PASSWORD = 'emp123';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('usuários padrão com as senhas do ambiente; acento e maiúscula não importam', async () => {
    expect(await AuthService.login('laçolaria', 'owner123')).toBe('OWNER');
    expect(await AuthService.login(' Lacolaria ', 'owner123')).toBe('OWNER');
    expect(await AuthService.login('balcao', 'emp123')).toBe('EMPLOYEE');
    expect(await AuthService.login('Balcão', 'emp123')).toBe('EMPLOYEE');
    expect(normUser('LAÇOLARIA')).toBe('lacolaria');
  });

  it('senha errada, senha do outro perfil ou vazia: não entra', async () => {
    expect(await AuthService.login('balcao', 'owner123')).toBeNull();
    expect(await AuthService.login('laçolaria', 'emp123')).toBeNull();
    expect(await AuthService.login('laçolaria', '')).toBeNull();
    expect(await AuthService.login('', 'owner123')).toBeNull();
  });

  it('sem senha no ambiente nem no banco, o perfil não entra (nada de senha vazia)', async () => {
    process.env.EMPLOYEE_PASSWORD = '';
    expect(await AuthService.login('balcao', '')).toBeNull();
    expect(await AuthService.login('balcao', 'qualquer')).toBeNull();
  });

  it('dono troca usuário e senha do balcão; a senha fica só em hash', async () => {
    await AuthService.change({ role: 'EMPLOYEE', user: 'caixa1', password: 'nova-senha', ownerPassword: 'owner123' });
    expect(await AuthService.login('caixa1', 'nova-senha')).toBe('EMPLOYEE');
    expect(await AuthService.login('balcao', 'emp123')).toBeNull();
    const s = await prisma.settings.findUniqueOrThrow({ where: { id: 'app' } });
    expect(s.authEmployeeHash).toMatch(/^\$2[aby]\$10\$/);
    expect(s.authEmployeeHash).not.toContain('nova-senha');
    expect((await AuthService.users()).find((u) => u.role === 'EMPLOYEE')).toEqual({ role: 'EMPLOYEE', user: 'caixa1', custom: true });
  });

  it('troca exige a senha do dono, senha de 6+ e usuários diferentes', async () => {
    await expect(AuthService.change({ role: 'EMPLOYEE', password: 'abcdef', ownerPassword: 'errada' })).rejects.toThrow('Senha do dono incorreta');
    await expect(AuthService.change({ role: 'EMPLOYEE', password: '123', ownerPassword: 'owner123' })).rejects.toThrow('ao menos 6');
    await expect(AuthService.change({ role: 'EMPLOYEE', user: 'Laçolaria', ownerPassword: 'owner123' })).rejects.toThrow('outro perfil');
    await expect(AuthService.change({ role: 'EMPLOYEE', ownerPassword: 'owner123' })).rejects.toThrow('Informe');
  });

  it('dono troca a própria senha: a do ambiente deixa de valer', async () => {
    await AuthService.change({ role: 'OWNER', password: 'segredo-novo', ownerPassword: 'owner123' });
    expect(await AuthService.login('laçolaria', 'segredo-novo')).toBe('OWNER');
    expect(await AuthService.login('laçolaria', 'owner123')).toBeNull();
  });
});
