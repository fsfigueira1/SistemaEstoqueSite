'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Barcode, Loader2, Tag } from 'lucide-react';
import type { ReviewProduct } from '@/lib/catalogReview';
import { ReviewCard } from './ReviewCard';

const PREVIEW = 12;

export function MissingBarcodeSection({ products, onGenerate }: { products: ReviewProduct[]; onGenerate: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = open ? products : products.slice(0, PREVIEW);

  const generate = async () => {
    if (!window.confirm(`Gerar um código de barras EAN-13 interno para ${products.length} produto(s)? O SKU continua valendo no leitor.`)) return;
    setBusy(true);
    try {
      await onGenerate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ReviewCard
      icon={<Barcode className="h-5 w-5 text-primary" />}
      title="Produtos sem código de barras"
      subtitle="Sem código, o produto só passa no PDV digitando o SKU. Gere um código interno (começa com 20) e imprima a etiqueta."
      empty={products.length ? null : 'Todos os produtos têm código de barras.'}
      footer={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/etiquetas?produtos=${products.map((p) => p.id).join(',')}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Tag className="h-4 w-4" /> Etiquetas destes produtos
          </Link>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
            Gerar códigos para os {products.length}
          </button>
        </div>
      }
    >
      <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1">
            <span className="truncate text-foreground" title={p.name}>
              {p.name}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">SKU {p.sku}</span>
          </li>
        ))}
      </ul>
      {products.length > PREVIEW && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-xs text-primary hover:underline">
          {open ? 'ver menos' : `ver todos os ${products.length}`}
        </button>
      )}
    </ReviewCard>
  );
}
