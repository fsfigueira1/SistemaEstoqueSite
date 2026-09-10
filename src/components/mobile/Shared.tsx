'use client';

import type { ReactNode } from 'react';

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-4 pb-1 pt-4 font-heading text-xl font-bold text-foreground">{children}</h1>;
}

export function Loading() {
  return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
}

export function ErrorMsg({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-red-600">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}
