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
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
      <Tag className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <b>
          {n} produto{n > 1 ? 's' : ''} {n > 1 ? 'mudaram' : 'mudou'} de preço
        </b>{' '}
        e a etiqueta da gôndola não foi reimpressa.
        <div className="truncate text-xs opacity-80">
          {sample}
          {n > 3 ? ` e mais ${n - 3}` : ''}
        </div>
      </div>
      <Link
        href="/etiquetas?filtro=alterados"
        className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Reimprimir etiquetas <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
