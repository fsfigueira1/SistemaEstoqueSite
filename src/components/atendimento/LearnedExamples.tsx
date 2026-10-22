'use client';

// "O que a IA aprendeu": respostas aprovadas que viram exemplo de tom para a
// atendente. Dá para apagar um exemplo que não representa a loja.

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Trash2 } from 'lucide-react';

type Example = { id: string; customerText: string; finalReply: string; createdAt: string };

export default function LearnedExamples({ refreshKey }: { refreshKey: number }) {
  const [list, setList] = useState<Example[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/copilot/examples');
      const d = await r.json();
      if (d.success) setList(d.data);
    } catch {
      /* lista é só informativa */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const remove = async (id: string) => {
    if (!window.confirm('Esquecer este exemplo? A IA deixa de usar esse jeito de responder.')) return;
    await fetch(`/api/copilot/examples/${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  };

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-5 py-3 text-left">
        <GraduationCap className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">O que a IA aprendeu</span>
        <span className="text-xs text-muted-foreground">({list.length})</span>
        <span className="ml-auto text-xs text-muted-foreground">{open ? 'esconder' : 'ver'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-5 py-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Cada resposta que você copia ou coloca no WhatsApp (com as suas correções) ensina o jeito da loja. As 6 mais recentes vão como exemplo para a IA.
          </p>
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ainda nada — comece aprovando algumas respostas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((e) => (
                <li key={e.id} className="flex gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">Cliente: {e.customerText}</p>
                    <p className="line-clamp-2 whitespace-pre-wrap text-foreground">{e.finalReply}</p>
                  </div>
                  <button type="button" onClick={() => remove(e.id)} title="Esquecer" className="self-start rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
