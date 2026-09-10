import DailyReportView from '@/components/DailyReportView';
import { PageTitle } from '@/components/mobile/Shared';

export default function MobileRelatorio() {
  return (
    <>
      <PageTitle>Relatório do dia</PageTitle>
      <DailyReportView />
    </>
  );
}
