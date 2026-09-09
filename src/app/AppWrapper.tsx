'use client';

import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import PinLock from '@/components/PinLock';
import OfflineSync from '@/components/OfflineSync';
import { ReactNode } from 'react';

export default function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <PinLock>
        <TooltipProvider>{children}</TooltipProvider>
        <OfflineSync />
      </PinLock>
    </ThemeProvider>
  );
}
