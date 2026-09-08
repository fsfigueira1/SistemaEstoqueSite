'use client';
import { useEffect, useState } from 'react';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [TooltipProvider, setTooltipProvider] = useState<any>(null);
  const [PinLock, setPinLock] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
    // Dynamically import the client components
    Promise.all([
      import("@/components/ui/tooltip").then(mod => mod.TooltipProvider),
      import("@/components/PinLock").then(mod => mod.default) // PinLock is default export
    ]).then(([TooltipProvider, PinLock]) => {
      setTooltipProvider(TooltipProvider);
      setPinLock(PinLock);
    });
  }, []);

  if (!isClient || !TooltipProvider || !PinLock) {
    return children;
  }

  return (
    <PinLock>
      <TooltipProvider>{children}</TooltipProvider>
    </PinLock>
  );
}