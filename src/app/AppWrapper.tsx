'use client';

import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import OfflineSync from '@/components/OfflineSync';
import { ReactNode } from 'react';

// O acesso é pelo login com usuário e senha (src/proxy.ts); o antigo PIN de
// tela (PinLock) saiu — ele não protegia nada além desta janela.
export default function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>{children}</TooltipProvider>
      <OfflineSync />
    </ThemeProvider>
  );
}
