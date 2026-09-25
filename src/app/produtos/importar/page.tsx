'use client';

// Produtos → Importar planilha: cadastra vários produtos de uma vez e lança a
// entrada no estoque (ex.: o pedido de um fornecedor). Mostra antes o que é
// novo, o que já existe e o lucro de cada item sobre o custo.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import ImportTable from '@/components/import/ImportTable';
import { parseImport, TEMPLATE_HEADER, type ImportRow } from '@/lib/productImport';
import { profitPercent } from '@/lib/profit';
import type { ImportResult, PreviewItem } from '@/services/productImportService';
import { errorText } from '@/lib/friendlyError';
import { loadSettings } from '@/lib/settings';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function downloadTemplate() {
  const csv = `\uFEFF${TEMPLATE_HEADER.join(';')}\n7891234567890;Caneta Esferográfica Azul 1.0mm;Escrita;Fornecedor X;50;1,00;2,50;10;;;;;\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-importar-produtos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportarProdutosPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ items: PreviewItem[]; newCategories: string[]; newSuppliers: string[] } | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<null | 'preview' | 'import'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [target, setTarget] = useState(110);

  useEffect(() => {
    loadSettings()
      .then((s) => setTarget(s.profitTargetPercent ?? 110))
      .catch(() => {});
  }, []);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    setResult(null);
    setPreview(null);
    setSkip(new Set());
    setFileName(f.name);
    try {
      if (/\.xlsx?$/i.test(f.name)) throw new Error('Salve a planilha como CSV (Arquivo → Salvar como → CSV) e escolha de novo');
      const parsed = parseImport(await f.text());
      if (parsed.missingColumns.length) throw new Error(`Faltam as colunas: ${parsed.missingColumns.join(', ')}`);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
      if (!parsed.rows.length) throw new Error('Nenhum produto na planilha');
      setBusy('preview');
      const r = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed.rows, dryRun: true }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui ler a planilha'));
      setPreview(data.data);
    } catch (e) {
      setErr(errorText(e, 'Não consegui ler a planilha'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const previewMap = useMemo(() => new Map((preview?.items ?? []).map((p) => [p.line, p])), [preview]);
  const chosen = rows.filter((r) => !skip.has(r.line) && previewMap.get(r.line)?.status !== 'error');
  const totals = useMemo(() => {
    let cost = 0;
    let sale = 0;
    let below = 0;
    for (const r of chosen) {
      cost += (r.cost ?? 0) * r.qty;
      sale += (r.price ?? 0) * r.qty;
      const p = profitPercent(r.cost, r.price);
      if (p != null && p < target - 0.05) below++;
    }
    return { cost, sale, below, profit: cost > 0 ? ((sale - cost) / cost) * 100 : null };
  }, [chosen, target]);

  const doImport = async () => {
    setBusy('import');
    setErr(null);
    try {
      const r = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: chosen }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Importação não concluída'));
      setResult(data.data);
    } catch (e) {
      setErr(errorText(e, 'Importação não concluída'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow="Produtos"
          title="Importar planilha"
          subtitle="Cadastre vários produtos de uma vez e lance a entrada no estoque"
          actions={
            <Link href="/produtos" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Produtos
            </Link>
          }
        />

        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{fileName || 'Escolha a planilha (.csv)'}</p>
            <p className="text-xs text-muted-foreground">
              Colunas: código de barras, nome, quantidade, custo, preço (e, se quiser, categoria, fornecedor, estoque
              mínimo). O produto que já existe (mesmo código) é atualizado e o estoque soma a quantidade.
            </p>
          </div>
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Download className="h-4 w-4" /> Modelo
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Escolher arquivo
          </button>
        </section>

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">{err}</div>}
        {parseErrors.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/15 p-3 text-sm text-warning-foreground">
            {parseErrors.length} linha(s) ignorada(s): {parseErrors.slice(0, 4).join(' · ')}
            {parseErrors.length > 4 && ' …'}
          </div>
        )}

        {result ? (
          <section className="rounded-2xl border border-success/30 bg-success/10 p-6">
            <p className="flex items-center gap-2 font-heading text-xl text-foreground">
              <CheckCircle2 className="h-6 w-6 text-success" /> Importação concluída
            </p>
            <p className="mt-2 text-sm text-foreground">
              {result.created} produto(s) novo(s), {result.updated} atualizado(s), {result.unitsAdded} unidade(s) no estoque.
              {result.stockSkipped > 0 && ` ${result.stockSkipped} já tinham o estoque lançado por esta planilha (não somou de novo).`}
            </p>
            {result.errors.length > 0 && (
              <p className="mt-1 text-sm text-danger">
                Com problema: {result.errors.map((e) => `linha ${e.line} (${e.message})`).join(', ')}
              </p>
            )}
            <Link href="/produtos" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Ver produtos
            </Link>
          </section>
        ) : (
          rows.length > 0 &&
          preview && (
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {(preview.newCategories.length > 0 || preview.newSuppliers.length > 0) && (
                <p className="border-b border-border bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
                  Serão criados:{' '}
                  {[...preview.newCategories.map((c) => `categoria "${c}"`), ...preview.newSuppliers.map((s) => `fornecedor "${s}"`)].join(', ')}
                </p>
              )}
              <ImportTable
                rows={rows}
                preview={previewMap}
                target={target}
                skip={skip}
                onSkip={(line, v) =>
                  setSkip((s) => {
                    const n = new Set(s);
                    if (v) n.add(line);
                    else n.delete(line);
                    return n;
                  })
                }
                onPrice={(line, price) => setRows((list) => list.map((r) => (r.line === line ? { ...r, price } : r)))}
              />
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-accent-soft/40 px-5 py-4">
                <div className="text-sm">
                  <p className="text-foreground">
                    <strong className="tabular-nums">{chosen.length}</strong> produto(s) · custo {brl(totals.cost)} · venda{' '}
                    {brl(totals.sale)}
                    {totals.profit != null && (
                      <>
                        {' '}
                        · lucro <strong className="tabular-nums">{totals.profit.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                      </>
                    )}
                  </p>
                  <p className={`text-xs ${totals.below ? 'text-danger' : 'text-muted-foreground'}`}>
                    {totals.below
                      ? `${totals.below} abaixo da meta de ${target}% de lucro`
                      : `Todos com pelo menos ${target}% de lucro sobre o custo`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={doImport}
                  disabled={Boolean(busy) || chosen.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar {chosen.length} produto(s)
                </button>
              </div>
            </section>
          )
        )}
      </div>
    </Layout>
  );
}
