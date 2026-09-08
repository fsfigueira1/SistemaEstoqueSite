'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import PinLock from '@/components/PinLock';
import { ReactNode } from 'react';

export default function ClientOnly({ children }: { children: ReactNode }) {
  return (
    <PinLock>
      <TooltipProvider>{children}</TooltipProvider>
    </PinLock>
  );
}