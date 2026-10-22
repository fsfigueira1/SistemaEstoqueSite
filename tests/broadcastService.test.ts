import { describe, beforeEach, it, expect } from 'vitest';
import { BroadcastService } from '../src/services/broadcastService';
import { ContactService } from '../src/services/contactService';
import { OPT_OUT_FOOTER } from '../src/lib/contacts';
import { cleanupDatabase } from './utils';

describe('BroadcastService', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await ContactService.importRows(
      [
        { name: 'Ana', phone: '5517999998888' },
        { name: 'Beto', phone: '5517988887777' },
        { name: 'Carla', phone: '5517977776666' },
      ],
      'planilha',
    );
    const carla = (await ContactService.list()).find((c) => c.name === 'Carla')!;
    await ContactService.setStatus(carla.id, false);
  });

  it('create tira foto dos destinatários ativos', async () => {
    const b = await BroadcastService.create('Olá, {nome}! Chegaram cadernos.');
    expect(b.total).toBe(2);
    const full = await BroadcastService.get(b.id);
    expect(full!.recipients.map((r) => r.name).sort()).toEqual(['Ana', 'Beto']);
    expect(full!.text).toBe('Olá, {nome}! Chegaram cadernos.');
    expect(full!.message.endsWith(OPT_OUT_FOOTER)).toBe(true);
  });

  it('create sem contatos ativos dá erro claro', async () => {
    await cleanupDatabase();
    await expect(BroadcastService.create('Oi')).rejects.toThrow('Nenhum contato recebendo novidades');
    await expect(BroadcastService.create('   ')).rejects.toThrow('Escreva a mensagem');
  });

  it('destinatário que saiu depois aparece como saiu', async () => {
    const b = await BroadcastService.create('Oi');
    const ana = (await ContactService.list()).find((c) => c.name === 'Ana')!;
    await ContactService.setStatus(ana.id, false);
    const full = await BroadcastService.get(b.id);
    expect(full!.recipients.find((r) => r.name === 'Ana')!.saiu).toBe(true);
    expect(full!.recipients.find((r) => r.name === 'Beto')!.saiu).toBe(false);
  });

  it('markSent marca e desmarca, e a lista conta os enviados', async () => {
    const b = await BroadcastService.create('Oi');
    const full = await BroadcastService.get(b.id);
    const first = full!.recipients[0];
    await BroadcastService.markSent(b.id, first.contactId, true);
    expect((await BroadcastService.list())[0]).toMatchObject({ id: b.id, total: 2, sent: 1 });
    expect((await BroadcastService.get(b.id))!.recipients.find((r) => r.contactId === first.contactId)!.sentAt).not.toBeNull();
    await BroadcastService.markSent(b.id, first.contactId, false);
    expect((await BroadcastService.list())[0].sent).toBe(0);
  });
});
