import { describe, beforeEach, it, expect } from 'vitest';
import { CirandaPaymentService as S, cirandaReply, isCirandaReceipt } from '../src/services/cirandaPaymentService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

const ANA = { name: 'Ana', phone: '5517999998888' };
const FOTO = 'data:image/jpeg;base64,AAAA';
const FULL = { childName: 'João', schoolGrade: 'Infantil 4', guardianName: 'Ana Souza' };

describe('CirandaPaymentService', () => {
  beforeEach(cleanupDatabase);

  it('comprovante primeiro, dados depois: uma linha só e fica completa', async () => {
    const a = await S.addReceipt(ANA, FOTO, 'R$ 100');
    expect(cirandaReply(a)).toMatch(/nome da criança, o ano escolar e o nome do responsável/);
    await S.addDetails(ANA, { childName: 'João' });
    const c = await S.addDetails(ANA, { schoolGrade: 'Infantil 4', guardianName: 'Ana Souza' });
    expect(c.id).toBe(a.id);
    expect(cirandaReply(c)).toMatch(/Prontinho.*João \(Infantil 4\)/);
    const [row] = await S.list();
    expect(row.missing).toEqual([]);
    expect(row).not.toHaveProperty('receiptImage');
  });

  it('dados primeiro, comprovante depois', async () => {
    const a = await S.addDetails(ANA, FULL);
    expect(cirandaReply(a)).toMatch(/comprovante do Pix/);
    const b = await S.addReceipt(ANA, FOTO, '');
    expect(b.id).toBe(a.id);
    expect(b.hasReceipt).toBe(true);
    expect(await S.receipt(b.id)).toBe(FOTO);
  });

  it('mesma foto de novo não cria outro pagamento; outro irmão cria', async () => {
    await S.addReceipt(ANA, FOTO, '');
    await S.addDetails(ANA, FULL);
    await S.addReceipt(ANA, FOTO, '');
    expect(await prisma.cirandaPayment.count()).toBe(1);
    await S.addReceipt(ANA, 'data:image/jpeg;base64,BBBB', '');
    expect(await prisma.cirandaPayment.count()).toBe(2);
  });

  it('conversas diferentes não se misturam; sem telefone usa o nome', async () => {
    await S.addReceipt(ANA, FOTO, '');
    const b = await S.addDetails({ name: 'Bia', phone: '' }, FULL);
    expect(b.hasReceipt).toBe(false);
    expect(await prisma.cirandaPayment.count()).toBe(2);
  });
});

describe('isCirandaReceipt', () => {
  it.each(['Recebedor: Associação de Pais e Mestres', 'CNPJ 10.352.702/0001-98', 'CNPJ ***.352.702/0001-**', 'APM Colégio'])('%s', (t) => expect(isCirandaReceipt(t)).toBe(true));
  it('outro recebedor não é', () => expect(isCirandaReceipt('Recebedor: Laçolaria Papelaria CNPJ 68.010.510/0001-83')).toBe(false));
});
