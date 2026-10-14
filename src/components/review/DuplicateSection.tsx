'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import type { DuplicateGroup } from '@/lib/catalogReview';
import { ReviewCard } from './ReviewCard';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const STATUS: Record<string, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', DISCONTINUED: 'Descontinuado' };

export function DuplicateSection({ groups, onInactivate }: { groups: DuplicateGroup[]; onInactivate: (ids: string[]) => Promise<void> }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(new Set()), [groups]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (!window.confirm(`Desativar ${picked.size} produto(s)? Eles somem do PDV, mas nada é apagado — dá para reativar no cadastro.`)) return;
    setBusy(true);
    try {
      await onInactivate([...picked]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ReviewCard
      icon={<Copy className="h-5 w-5 text-primary" />}
      title="Nomes duplicados"
      subtitle="Produtos com o mesmo nome (ignorando acento, maiúsculas e pontuação). Marque o que sobra para desativar — confira código e estoque antes."
      empty={groups.length ? null : 'Nenhum nome duplicado.'}
      footer={
        <button
          type="button"
          onClick={apply}
          disabled={busy || picked.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Desativar {picked.size || ''} selecionado{picked.size === 1 ? '' : 's'}
        </button>
      }
    >
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key} className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                  <th className="px-3 py-2 text-right">Estoque</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.products.map((p) => (
                  <tr key={p.id} className={`border-b border-border last:border-0 ${picked.has(p.id) ? 'bg-danger/5' : ''}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        disabled={p.status !== 'ACTIVE'}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4"
                        aria-label={`Desativar ${p.name} (${p.sku})`}
                      />
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {p.name}
                      {p.categoryName && <div className="text-xs text-muted-foreground">{p.categoryName}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {p.barcode || '—'}
                      {p.sku !== p.barcode && <div>SKU {p.sku}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(p.salePrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.stockQuantity}</td>
                    <td className="px-3 py-2">
                      <span className={`pill ${p.status === 'ACTIVE' ? 'pill-ok' : 'pill-muted'}`}>{STATUS[p.status] ?? p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Dica: se os dois existem de verdade (ex.: cores diferentes), corrija o nome no cadastro de Produtos em vez de desativar.
      </p>
    </ReviewCard>
  );
}
