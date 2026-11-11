'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';

/**
 * Aviso do Painel: produtos cujo preço mudou depois da última etiqueta
 * impressa — a gôndola está mostrando preço velho. Some quando está tudo em dia.
 */
export function LabelReminder() {
  const [changed, setChanged] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch('/api/labels/stale')
      .then((r) => r.json())
      .then((r) => {
        if (r?.success) setChanged(r.data.changed ?? []);
      })
      .catch(() => {});
  }, []);

  if (!changed.length) return null;
  const n = changed.length;
  const sample = changed.slice(0, 3).map((p) => p.name).join(', ');
  return (
    <div className="koda-ink flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-[color-mix(in_oklch,var(--primary)_8%,var(--ink))] px-6 py-4 text-sm">
      <span className="font-heading text-3xl font-bold tabular-nums text-primary" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <b className="text-[15px]">
          {n} produto{n > 1 ? 's' : ''} {n > 1 ? 'mudaram' : 'mudou'} de preço e a etiqueta da gôndola não foi reimpressa.
        </b>
        <div className="truncate text-xs uppercase text-muted-foreground">
          {sample}
          {n > 3 ? ` e mais ${n - 3}` : ''}
        </div>
      </div>
      <Link
        href="/etiquetas?filtro=alterados"
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Tag className="h-4 w-4" /> Reimprimir etiquetas <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
