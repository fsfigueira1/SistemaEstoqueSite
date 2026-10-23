'use client';

// Lista escolar → "Salvar como lista da escola": guarda a lista conferida
// como Escola – Série – Ano letivo. Salvar de novo a mesma combinação
// substitui os itens e mantém o código (o botão do site continua valendo).

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/lib/friendlyError';
import { defaultSchoolYear, type SavedItemInput } from '@/lib/savedLists';

type Saved = { code: string; schoolName: string; grade: string; schoolYear: number };

export default function SaveListDialog({
  open,
  onOpenChange,
  sourceText,
  items,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceText: string;
  items: SavedItemInput[];
  initial?: { schoolName: string; grade: string; schoolYear: number };
  onSaved?: () => void;
}) {
  const [schools, setSchools] = useState<string[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaved(null);
    setSchoolName(initial?.schoolName ?? '');
    setGrade(initial?.grade ?? '');
    setSchoolYear(initial?.schoolYear ?? defaultSchoolYear());
    fetch('/api/school-lists/schools')
      .then((r) => r.json())
      .then((d) => d.success && setSchools(d.data.map((s: { name: string }) => s.name)))
      .catch(() => {});
  }, [open, initial]);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/school-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName, grade, schoolYear, sourceText, items }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui salvar'));
      setSaved(data.data);
      onSaved?.();
    } catch (e) {
      setErr(errorText(e, 'Não consegui salvar'));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o código:', code);
    }
  };

  const field = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como lista da escola</DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? 'item' : 'itens'}. O orçamento sempre sai com o preço e o estoque do dia.
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="space-y-3 rounded-xl border border-success/30 bg-success/10 p-4">
            <p className="text-sm text-foreground">
              Lista salva: <strong>{saved.schoolName}</strong> — {saved.grade} ({saved.schoolYear})
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-semibold tracking-wider text-foreground">{saved.code}</span>
              <button
                type="button"
                onClick={() => copy(saved.code)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar código'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Escola</span>
              <input list="school-names" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Colégio São José" className={field} />
              <datalist id="school-names">
                {schools.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Série</span>
                <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="3º ano" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Ano letivo</span>
                <input
                  type="number"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(Number(e.target.value))}
                  className={`${field} tabular-nums`}
                />
              </label>
            </div>
            {err && <p className="text-sm font-medium text-danger">{err}</p>}
          </div>
        )}

        <DialogFooter>
          {saved ? (
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Fechar
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={saving || !schoolName.trim() || !grade.trim() || !items.length}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar lista
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
