'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import { TypoSection } from '@/components/review/TypoSection';
import { DuplicateSection } from '@/components/review/DuplicateSection';
import { MissingBarcodeSection } from '@/components/review/MissingBarcodeSection';
import { errorText } from '@/lib/friendlyError';
import type { CatalogReport } from '@/services/catalogReviewService';

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(errorText(data, 'Não foi possível salvar'));
  return data.data;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${value ? 'text-foreground' : 'text-emerald-600'}`}>{value}</div>
    </div>
  );
}

// Revisão do cadastro: erros de digitação, espaços sobrando, nomes
// duplicados e produtos sem código — com correção em lote.
export default function RevisaoPage() {
  const [report, setReport] = useState<CatalogReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/catalog-review').then((x) => x.json());
      if (r?.success) setReport(r.data);
      else setNotice({ ok: false, text: errorText(r, 'Não foi possível carregar a revisão') });
    } catch {
      setNotice({ ok: false, text: 'Sem conexão com o servidor.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // grava, avisa e recarrega o relatório
  const run = async (action: () => Promise<string>) => {
    setNotice(null);
    try {
      setNotice({ ok: true, text: await action() });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Erro ao salvar' });
    }
    await load();
  };

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <PageHeader
          eyebrow="Gestão"
          title="Revisão de cadastro"
          subtitle="Ache e corrija em lote nomes errados, duplicados e produtos sem código"
          actions={
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Analisar de novo
            </button>
          }
        />

        {notice && (
          <div
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${notice.ok ? 'border-emerald-600/30 bg-emerald-600/10 text-foreground' : 'border-danger/30 bg-danger/10 text-danger'}`}
          >
            {notice.text}
          </div>
        )}

        {!report ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Analisando o cadastro…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Erros de digitação" value={report.typos.length} />
              <Stat label="Espaços sobrando" value={report.spacing.length} />
              <Stat label="Nomes duplicados" value={report.duplicates.length} />
              <Stat label="Sem código de barras" value={report.missingBarcode.length} />
            </div>

            <TypoSection
              typos={report.typos}
              spacing={report.spacing}
              onApply={(fixes, spacing) =>
                run(async () => {
                  const d = await post('/api/catalog-review', { action: 'names', fixes, spacing });
                  return `${d.renamed} nome(s) corrigido(s). O nome antigo ficou no histórico.`;
                })
              }
            />
            <DuplicateSection
              groups={report.duplicates}
              onInactivate={(ids) =>
                run(async () => {
                  const d = await post('/api/catalog-review', { action: 'inactivate', ids });
                  return `${d.inactivated} produto(s) desativado(s).`;
                })
              }
            />
            <MissingBarcodeSection
              products={report.missingBarcode}
              onGenerate={() =>
                run(async () => {
                  const d = await post('/api/labels/barcodes');
                  return `${d.updated} código(s) gerado(s). Imprima as etiquetas para colar nos produtos.`;
                })
              }
            />
          </>
        )}
      </div>
    </Layout>
  );
}
