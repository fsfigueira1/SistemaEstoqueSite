'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, SpellCheck } from 'lucide-react';
import type { NameChange, TypoGroup } from '@/lib/catalogReview';
import { replaceWord, tidySpaces } from '@/lib/catalogReview';
import { ReviewCard } from './ReviewCard';

interface Choice {
  on: boolean;
  right: string;
}

function preview(name: string, wrong: string, right: string, spacing: boolean) {
  const out = right.trim() ? replaceWord(name, wrong, right.trim()) : name;
  return spacing ? tidySpaces(out) : out;
}

function TypoRow({ g, choice, spacing, onChange }: { g: TypoGroup; choice: Choice; spacing: boolean; onChange: (c: Choice) => void }) {
  const [open, setOpen] = useState(false);
  const shown = open ? g.products : g.products.slice(0, 2);
  return (
    <li className={`rounded-lg border p-3 ${choice.on ? 'border-primary/50 bg-accent-soft/40' : 'border-border'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={choice.on}
          onChange={(e) => onChange({ ...choice, on: e.target.checked })}
          className="h-4 w-4"
          aria-label={`Corrigir ${g.wrongDisplay}`}
        />
        <span className="rounded bg-danger/10 px-2 py-0.5 font-mono text-sm text-danger line-through decoration-danger/50">{g.wrongDisplay}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <input
          value={choice.right}
          onChange={(e) => onChange({ on: true, right: e.target.value.replace(/\s/g, '') })}
          className="w-44 rounded border border-border px-2 py-0.5 font-mono text-sm focus:border-ring focus:ring-2 focus:ring-ring/40"
          aria-label="Grafia correta"
        />
        <span className="text-xs text-muted-foreground">
          aparece {g.rightCount}× no catálogo · {g.products.length} produto{g.products.length > 1 ? 's' : ''}
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 pl-6 text-xs">
        {shown.map((p) => (
          <li key={p.id} className="text-muted-foreground">
            {p.name} <span className="text-foreground">→ {preview(p.name, g.wrong, choice.right, spacing)}</span>
          </li>
        ))}
      </ul>
      {g.products.length > 2 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 pl-6 text-xs text-primary hover:underline">
          {open ? 'ver menos' : `ver todos os ${g.products.length}`}
        </button>
      )}
    </li>
  );
}

export function TypoSection({
  typos,
  spacing,
  onApply,
}: {
  typos: TypoGroup[];
  spacing: NameChange[];
  onApply: (fixes: Array<{ wrong: string; right: string }>, spacing: boolean) => Promise<void>;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [fixSpacing, setFixSpacing] = useState(false);
  const [showSpacing, setShowSpacing] = useState(false);
  const [busy, setBusy] = useState(false);

  // relatório novo (depois de corrigir): começa tudo desmarcado
  useEffect(() => {
    setChoices(Object.fromEntries(typos.map((g) => [g.wrong, { on: false, right: g.right.toLowerCase() }])));
    setFixSpacing(false);
  }, [typos]);

  const selected = typos.filter((g) => choices[g.wrong]?.on && choices[g.wrong].right.trim());
  const affected = new Set([...selected.flatMap((g) => g.products.map((p) => p.id)), ...(fixSpacing ? spacing.map((s) => s.id) : [])]);

  const apply = async () => {
    if (!window.confirm(`Corrigir o nome de ${affected.size} produto(s)? O nome antigo fica guardado no histórico.`)) return;
    setBusy(true);
    try {
      await onApply(
        selected.map((g) => ({ wrong: g.wrong, right: choices[g.wrong].right.trim() })),
        fixSpacing,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ReviewCard
      icon={<SpellCheck className="h-5 w-5 text-primary" />}
      title="Erros de digitação nos nomes"
      subtitle="Palavras raras quase iguais a uma bem mais comum, em produtos parecidos. Confira, ajuste se precisar e marque o que corrigir."
      empty={!typos.length && !spacing.length ? 'Nenhum erro de digitação encontrado.' : null}
      footer={
        <button
          type="button"
          onClick={apply}
          disabled={busy || affected.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Corrigir {affected.size || ''} produto{affected.size === 1 ? '' : 's'}
        </button>
      }
    >
      {typos.length > 0 && (
        <div className="mb-2 flex gap-3 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setChoices((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { ...v, on: true }])))}>
            marcar todos
          </button>
          <button type="button" className="text-primary hover:underline" onClick={() => setChoices((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { ...v, on: false }])))}>
            desmarcar todos
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {typos.map((g) => (
          <TypoRow
            key={g.wrong}
            g={g}
            choice={choices[g.wrong] ?? { on: false, right: g.right }}
            spacing={fixSpacing}
            onChange={(c) => setChoices((prev) => ({ ...prev, [g.wrong]: c }))}
          />
        ))}
      </ul>
      {spacing.length > 0 && (
        <div className={`mt-3 rounded-lg border p-3 ${fixSpacing ? 'border-primary/50 bg-accent-soft/40' : 'border-border'}`}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fixSpacing} onChange={(e) => setFixSpacing(e.target.checked)} className="h-4 w-4" />
            Tirar espaços sobrando de <b>{spacing.length}</b> nome{spacing.length > 1 ? 's' : ''}
            <button type="button" onClick={() => setShowSpacing(!showSpacing)} className="text-xs text-primary hover:underline">
              {showSpacing ? 'esconder' : 'ver quais'}
            </button>
          </label>
          {showSpacing && (
            <ul className="mt-2 space-y-0.5 pl-6 font-mono text-xs text-muted-foreground">
              {spacing.map((s) => (
                <li key={s.id} className="whitespace-pre">
                  “{s.name}”
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ReviewCard>
  );
}
