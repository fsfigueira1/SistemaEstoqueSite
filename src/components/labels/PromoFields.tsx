'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { Barcode, Loader2, Tag, X } from 'lucide-react';

export interface PromoValue {
  /** preço "de" (vazio = sem promoção) */
  de: string;
  /** último dia "AAAA-MM-DD" (vazio = sem data) */
  ate: string;
}
const EMPTY: PromoValue = { de: '', ate: '' };

const toNum = (s: string) => Number(String(s).replace(',', '.'));

/** Estado da promoção no cadastro: carrega ao editar, salva depois do produto. */
export function useProductPromo() {
  const [promo, setPromo] = useState<PromoValue>(EMPTY);
  const original = useRef<PromoValue>(EMPTY);

  const load = useCallback(async (productId: string | null) => {
    original.current = EMPTY;
    setPromo(EMPTY);
    if (!productId) return;
    try {
      const r = await fetch(`/api/labels?ids=${encodeURIComponent(productId)}`).then((x) => x.json());
      const i = r?.success ? r.data?.[0] : null;
      const v = { de: i?.compareAtPrice ? String(i.compareAtPrice) : '', ate: i?.promoUntil ?? '' };
      original.current = v;
      setPromo(v);
    } catch {
      /* sem promoção carregada: o campo fica vazio */
    }
  }, []);

  const changed = () => promo.de !== original.current.de || promo.ate !== original.current.ate;

  /** Valida antes de salvar o produto. */
  const validate = (salePrice: number): string | null => {
    if (!promo.de.trim()) return null;
    const de = toNum(promo.de);
    if (!Number.isFinite(de) || de <= 0) return 'Preço "de" inválido';
    if (Math.round(de * 100) <= Math.round(salePrice * 100)) return 'O preço "de" precisa ser maior que o preço de venda';
    return null;
  };

  /** Grava (só se mudou). Devolve a mensagem de erro, se houver. */
  const save = async (productId: string): Promise<string | null> => {
    if (!changed()) return null;
    try {
      const r = await fetch('/api/labels/promo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          compareAtPrice: promo.de.trim() ? toNum(promo.de) : null,
          promoUntil: promo.de.trim() && promo.ate ? promo.ate : null,
        }),
      }).then((x) => x.json());
      return r?.success ? null : r?.error || 'Não foi possível salvar a promoção';
    } catch {
      return 'Sem conexão ao salvar a promoção';
    }
  };

  return { promo, setPromo, load, changed, validate, save };
}

/** Campos "Promoção" do cadastro: preço "de" + válida até. */
export function PromoFields({
  value,
  onChange,
  error,
  inputCls,
}: {
  value: PromoValue;
  onChange: (v: PromoValue) => void;
  error?: string | null;
  inputCls: (error?: string) => string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/90">
        <Tag className="h-4 w-4 text-primary" /> Oferta na etiqueta <span className="font-normal text-muted-foreground">(opcional)</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Preço &ldquo;de&rdquo; (riscado)
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.de}
            onChange={(e) => onChange({ ...value, de: e.target.value })}
            className={`mt-1 ${inputCls(error ?? undefined)}`}
            placeholder="Ex.: 19,90"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Válida até (opcional)
          <input
            type="date"
            value={value.ate}
            disabled={!value.de.trim()}
            onChange={(e) => onChange({ ...value, ate: e.target.value })}
            className={`mt-1 ${inputCls()}`}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          A etiqueta sai &ldquo;DE R$ X POR R$ Y&rdquo;, onde Y é o preço de venda acima (o que o PDV cobra). Depois da data, volta a etiqueta normal.
        </p>
      )}
    </div>
  );
}

/** Botão "Gerar" ao lado do código de barras: próximo EAN-13 interno livre. */
export function GenerateBarcodeButton({ onCode }: { onCode: (code: string) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/labels/barcodes').then((x) => x.json());
      if (r?.success) onCode(r.data.barcode);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title="Gerar um código EAN-13 interno (para produto sem código de fábrica)"
      className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
      Gerar
    </button>
  );
}

/** Aviso depois de salvar: atalho para imprimir a etiqueta do produto. */
export function PrintLabelNotice({
  saved,
  onClose,
}: {
  saved: { id: string; name: string; warning?: string | null } | null;
  onClose: () => void;
}) {
  if (!saved) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-accent-soft/60 px-4 py-3 text-sm text-foreground">
      <span>
        <b>{saved.name}</b> salvo.{saved.warning ? <span className="text-danger"> {saved.warning}</span> : null}
      </span>
      <Link
        href={`/etiquetas?produtos=${encodeURIComponent(saved.id)}`}
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Tag className="h-3.5 w-3.5" /> Imprimir etiqueta
      </Link>
      <button onClick={onClose} className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar aviso">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
