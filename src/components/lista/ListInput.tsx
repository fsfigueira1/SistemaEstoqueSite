'use client';

// Lista escolar → entrada: colar o texto ou tirar/escolher a foto da lista.

import { useRef, useState } from 'react';
import { Camera, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { blobToDataUrl, readImageLocally, shrinkImage } from '@/lib/ocrClient';
import { errorText } from '@/lib/friendlyError';

export default function ListInput({
  text,
  setText,
  onBuild,
  building,
  aiAvailable,
}: {
  text: string;
  setText: (v: string) => void;
  onBuild: () => void;
  building: boolean;
  aiAvailable: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [useAi, setUseAi] = useState(false);
  const [reading, setReading] = useState<null | { label: string; pct: number | null }>(null);
  const [err, setErr] = useState<string | null>(null);

  const readPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const parts: string[] = [];
    try {
      for (const [i, f] of [...files].entries()) {
        const label = files.length > 1 ? `Lendo foto ${i + 1} de ${files.length}…` : 'Lendo a foto…';
        if (useAi && aiAvailable) {
          setReading({ label: `${label} (IA)`, pct: null });
          const image = await blobToDataUrl(await shrinkImage(f, 1600, 0.85));
          const r = await fetch('/api/school-list/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image }),
          });
          const data = await r.json();
          if (!r.ok || !data.success) throw new Error(errorText(data, 'A IA não conseguiu ler'));
          parts.push(data.data.text);
        } else {
          setReading({ label, pct: 0 });
          parts.push(await readImageLocally(f, (p) => setReading({ label, pct: p })));
        }
      }
      const read = parts.join('\n').trim();
      if (!read) throw new Error('Não achei texto na foto — tente outra mais nítida');
      setText([text.trim(), read].filter(Boolean).join('\n'));
    } catch (e) {
      setErr(errorText(e, 'Não consegui ler a foto'));
    } finally {
      setReading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg text-foreground">A lista</h2>
        <div className="flex flex-wrap items-center gap-3">
          {aiAvailable && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Melhor para letra de mão (usa a chave do Claude)">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="h-3.5 w-3.5" />
              <Sparkles className="h-3.5 w-3.5 text-bow" /> Ler com IA
            </label>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => readPhotos(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={Boolean(reading)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Camera className="h-4 w-4 text-primary" /> Foto da lista
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        placeholder={'Cole aqui a lista que a escola mandou, um item por linha. Ex.:\n2 cadernos universitários 10 matérias\n3 lápis preto nº 2\n1 caixa de lápis de cor 12 cores\n1 tesoura sem ponta'}
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed focus:border-ring focus:ring-2 focus:ring-ring/40"
      />

      {reading && (
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{reading.label}</span>
          {reading.pct != null && (
            <span className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(reading.pct * 100)}%` }} />
            </span>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-sm font-medium text-danger">{err}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Confira o texto lido da foto antes de montar — dá para corrigir aqui mesmo.
        </p>
        <button
          type="button"
          onClick={onBuild}
          disabled={building || !text.trim() || Boolean(reading)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Montar orçamento
        </button>
      </div>
    </section>
  );
}
