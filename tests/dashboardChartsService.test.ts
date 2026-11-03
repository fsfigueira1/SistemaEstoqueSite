import { describe, beforeEach, it, expect } from 'vitest';
import { getDashboardCharts } from '../src/services/dashboardChartsService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { CashSessionService } from '../src/services/cashSessionService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

// sexta 23/10/2026, 15h em Brasília
const NOW = new Date('2026-10-23T15:00:00-03:00');
const at = (iso: string) => new Date(`${iso}-03:00`);

describe('Gráficos do Painel', () => {
  let userId: string;
  let sessionId: string;
  let n = 0;

  async function sale(when: string, total: number) {
    n += 1;
    await prisma.sale.create({
      data: {
        saleNumber: `D${n}`,
        cashSessionId: sessionId,
        createdById: userId,
        status: 'COMPLETED',
        subtotal: total,
        totalAmount: total,
        paidAmount: total,
        createdAt: at(when),
        payments: { create: [{ method: 'PIX', amount: total, status: 'PAID', processedById: userId }] },
      },
    });
  }

  beforeEach(async () => {
    await cleanupDatabase();
    userId = (await createAdminUser()).id;
    const reg = await CashRegisterService.createCashRegister({ name: 'Caixa', description: '', isActive: true });
    sessionId = (await CashSessionService.openCashSession({ cashRegisterId: reg.id, openedById: userId, openingAmount: 0 })).id;
  });

  it('hoje x semana passada, mês x mesmo trecho do mês anterior, 35 dias e horário de pico', async () => {
    await sale('2026-10-23T10:15:00', 40); // hoje 10h
    await sale('2026-10-23T14:40:00', 60); // hoje 14h
    await sale('2026-10-16T11:00:00', 50); // sexta passada
    await sale('2026-09-10T11:00:00', 80); // mês passado, antes do dia 23
    await sale('2026-09-28T11:00:00', 999); // mês passado, depois do dia 23: fora da comparação

    const c = await getDashboardCharts(NOW);
    expect(c.today).toMatchObject({ revenue: 100, count: 2, avgTicket: 50, lastWeek: 50 });
    expect(c.month).toMatchObject({ revenue: 150, count: 3, prevToDate: 80 });
    expect(c.month.methods.pix).toBe(150);
    expect(c.days).toHaveLength(35);
    expect(c.days[34]).toEqual({ date: '2026-10-23', revenue: 100, count: 2 });
    // só a faixa de horas com venda nos 35 dias (10h a 14h)
    expect(c.hours.map((h) => h.hour)).toEqual([10, 11, 12, 13, 14]);
    // 11h: sexta passada (50) + 28/09 (999), que também está nos últimos 35 dias
    expect(c.hours.find((h) => h.hour === 11)?.revenue).toBe(1049);
  });
});
