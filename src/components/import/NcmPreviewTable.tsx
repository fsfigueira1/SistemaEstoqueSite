'use client';

// Prévia do NCM pelas notas de compra: um produto por linha, com o NCM de
// hoje e o da nota. Os que já estão iguais aparecem sem caixa de marcar.

import type { NcmPrevia } from '@/services/ncmImportService';

const fmtNcm = (n: string) => (n.length === 8 ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : n || '—');

const ROTULO: Record<NcmPrevia['situacao'], { txt: string; cls: string }> = {
  novo: { txt: 'sem NCM', cls: 'bg-primary/10 text-primary' },
  diferente: { txt: 'diferente', cls: 'bg-warning/20 text-warning-foreground' },
  igual: { txt: 'já igual', cls: 'bg-muted text-muted-foreground' },
};

export default function NcmPreviewTable({
  linhas,
  marcados,
  onMarcar,
}: {
  linhas: NcmPrevia[];
  marcados: Set<string>;
  onMarcar: (productId: string, v: boolean) => void;
}) {
  const marcaveis = linhas.filter((l) => l.situacao !== 'igual');
  const todos = marcaveis.length > 0 && marcaveis.every((l) => marcados.has(l.productId));
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
          <tr>
            <th className="px-4 py-2">
              <input
                type="checkbox"
                aria-label="Marcar todos"
                checked={todos}
                onChange={(e) => marcaveis.forEach((l) => onMarcar(l.productId, e.target.checked))}
              />
            </th>
            <th className="px-2 py-2">Produto</th>
            <th className="px-2 py-2">Código de barras</th>
            <th className="px-2 py-2">NCM hoje</th>
            <th className="px-2 py-2">NCM da nota</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.productId} className="border-t border-border align-top">
              <td className="px-4 py-2">
                {l.situacao !== 'igual' && (
                  <input
                    type="checkbox"
                    aria-label={`Gravar NCM em ${l.nome}`}
                    checked={marcados.has(l.productId)}
                    onChange={(e) => onMarcar(l.productId, e.target.checked)}
                  />
                )}
              </td>
              <td className="px-2 py-2">
                <p className="font-medium text-foreground">{l.nome}</p>
                {l.nomeNaNota && <p className="text-xs text-muted-foreground">na nota: {l.nomeNaNota}</p>}
              </td>
              <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{l.barcode}</td>
              <td className="px-2 py-2 font-mono">{fmtNcm(l.ncmAtual)}</td>
              <td className="px-2 py-2 font-mono">
                {fmtNcm(l.ncmNota)}
                {l.cestNota && <span className="block text-xs text-muted-foreground">CEST {l.cestNota}</span>}
                {l.outrosNcm.length > 0 && (
                  <span className="block text-xs text-warning-foreground">outras notas: {l.outrosNcm.map(fmtNcm).join(', ')}</span>
                )}
              </td>
              <td className="px-2 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${ROTULO[l.situacao].cls}`}>{ROTULO[l.situacao].txt}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
