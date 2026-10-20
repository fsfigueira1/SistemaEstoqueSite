'use client';

// Lista escolar → "Abrir lista salva": escolhe uma lista já conferida e o
// orçamento sai com o preço e o estoque de agora.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Loader2 } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';
import type { SavedQuoteLine } from '@/lib/savedLists';

export type SavedListSummary = {
  id: string;
  code: string;
  schoolName: string;
  grade: string;
  schoolYear: number;
  itemCount: number;
  active: boolean;
};

export default function OpenSavedList({
  onOpen,
  refreshKey = 0,
}: {
  onOpen: (list: SavedListSummary, lines: SavedQuoteLine[], sourceText: string) => void;
  /** muda depois de salvar uma lista, para o menu já mostrar a nova */
  refreshKey?: number;
}) {
  const [lists, setLists] = useState<SavedListSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/school-lists')
      .then((r) => r.json())
      .then((d) => d.success && setLists(d.data))
      .catch(() => {});
  }, [refreshKey]);

  const bySchool = useMemo(() => {
    const m = new Map<string, SavedListSummary[]>();
    for (const l of lists) m.set(l.schoolName, [...(m.get(l.schoolName) ?? []), l]);
    return [...m.entries()];
  }, [lists]);

  const open = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/school-lists/${encodeURIComponent(id)}`);
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui abrir a lista'));
      onOpen(data.data.list, data.data.lines, data.data.sourceText ?? '');
    } catch (e) {
      setErr(errorText(e, 'Não consegui abrir a lista'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
      <FolderOpen className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">Abrir lista salva</span>
      <select
        value=""
        onChange={(e) => open(e.target.value)}
        disabled={loading || !lists.length}
        className="min-w-64 rounded-lg border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
      >
        <option value="">{lists.length ? 'Escolha a escola e a série…' : 'Nenhuma lista salva ainda'}</option>
        {bySchool.map(([school, ls]) => (
          <optgroup key={school} label={school}>
            {ls.map((l) => (
              <option key={l.id} value={l.id}>
                {l.grade} — {l.schoolYear} ({l.itemCount} itens){l.active ? '' : ' · desativada'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      {err && <span className="text-sm font-medium text-danger">{err}</span>}
      <Link href="/lista-escolar/salvas" className="ml-auto text-sm text-primary hover:underline">
        Gerenciar listas salvas
      </Link>
    </section>
  );
}
