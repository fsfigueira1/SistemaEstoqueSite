import { describe, beforeEach, it, expect } from 'vitest';
import { ContactService } from '../src/services/contactService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

describe('ContactService', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('importRows cria com optInAt', async () => {
    const r = await ContactService.importRows([{ name: 'Ana', phone: '5517999998888' }], 'planilha');
    expect(r).toEqual({ criados: 1, atualizados: 0 });
    const [c] = await ContactService.list();
    expect(c).toMatchObject({ name: 'Ana', phone: '5517999998888', source: 'planilha', status: 'ativo' });
  });

  it('importRows não duplica e não reativa quem saiu', async () => {
    await ContactService.importRows([{ name: '', phone: '5517999998888' }], 'planilha');
    const [c] = await ContactService.list();
    await ContactService.setStatus(c.id, false);
    const r = await ContactService.importRows(
      [
        { name: 'Ana Souza', phone: '5517999998888' },
        { name: 'Beto', phone: '5517988887777' },
      ],
      'planilha',
    );
    expect(r).toEqual({ criados: 1, atualizados: 1 });
    const list = await ContactService.list();
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.phone === '5517999998888')).toMatchObject({ name: 'Ana Souza', status: 'saiu' });
  });

  it('previewImport conta novos e existentes', async () => {
    await ContactService.importRows([{ name: 'Ana', phone: '5517999998888' }], 'planilha');
    const p = await ContactService.previewImport([
      { name: 'Ana', phone: '5517999998888' },
      { name: 'Beto', phone: '5517988887777' },
    ]);
    expect(p).toEqual({ novos: 1, existentes: 1 });
  });

  it('contato do WhatsApp sem SIM fica pendente e a planilha ativa ele', async () => {
    await prisma.contact.create({ data: { phone: '5517977776666', source: 'whatsapp' } });
    expect((await ContactService.list())[0].status).toBe('pendente');
    await ContactService.importRows([{ name: 'Carla', phone: '5517977776666' }], 'planilha');
    expect((await ContactService.list())[0]).toMatchObject({ status: 'ativo', name: 'Carla', source: 'whatsapp' });
  });

  it('importCustomers liga customerId e ignora telefone inválido', async () => {
    const ok = await prisma.customer.create({ data: { name: 'Dora', phone: '(17) 99111-2222' } });
    await prisma.customer.create({ data: { name: 'Sem fone', phone: '123' } });
    await prisma.customer.create({ data: { name: 'Nulo' } });
    const r = await ContactService.importCustomers();
    expect(r).toEqual({ criados: 1, atualizados: 0 });
    const c = await prisma.contact.findUniqueOrThrow({ where: { phone: '5517991112222' } });
    expect(c).toMatchObject({ customerId: ok.id, source: 'cliente', name: 'Dora' });
    expect(c.optInAt).not.toBeNull();
  });

  it('setStatus sai e volta', async () => {
    await ContactService.importRows([{ name: 'Ana', phone: '5517999998888' }], 'manual');
    const [c] = await ContactService.list();
    await ContactService.setStatus(c.id, false);
    expect((await ContactService.list())[0].status).toBe('saiu');
    await ContactService.setStatus(c.id, true);
    expect((await ContactService.list())[0].status).toBe('ativo');
  });

  it('remove apaga o contato', async () => {
    await ContactService.importRows([{ name: 'Ana', phone: '5517999998888' }], 'manual');
    const [c] = await ContactService.list();
    await ContactService.remove(c.id);
    expect(await ContactService.list()).toHaveLength(0);
  });
});
