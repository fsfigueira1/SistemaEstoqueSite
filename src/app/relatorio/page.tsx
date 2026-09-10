'use client';

import Layout from '@/components/Layout';
import DailyReportView from '@/components/DailyReportView';

export default function RelatorioPage() {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <h1 className="px-4 pt-6 font-heading text-2xl font-bold text-foreground">Relatório do dia</h1>
        <p className="px-4 text-sm text-muted-foreground">
          Gerado automaticamente às 19:00 (horário de Brasília).
        </p>
        <DailyReportView />
      </div>
    </Layout>
  );
}
