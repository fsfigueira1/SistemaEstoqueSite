'use client';

// Produtos → NCM pelas notas de compra: lê os XML das NF-e dos fornecedores
// aqui no navegador, casa pelo código de barras com o cadastro e grava o NCM
// (e o CEST) só dos produtos que a dona deixar marcados.

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileCode2, FolderOpen, Loader2, Upload } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import NcmPreviewTable from '@/components/import/NcmPreviewTable';
import { itensDaNotaCompra, juntarPorEan, type ItemNotaCompra } from '@/lib/ncmFromNfe';
import type { NcmPreviaResultado } from '@/services/ncmImportService';
import { errorText } from '@/lib/friendlyError';

type Leitura = { arquivos: number; notas: number; itens: number; codigos: number };

async function lerArquivos(files: File[]): Promise<{ itens: ItemNotaCompra[]; leitura: Leitura }> {
  const xmls = files.filter((f) => /\.xml$/i.test(f.name));
  const itens: ItemNotaCompra[] = [];
  let notas = 0;
  for (const f of xmls) {
    const lidos = itensDaNotaCompra(await f.text(), f.name);
    if (lidos.length) notas++;
    itens.push(...lidos);
  }
  return { itens, leitura: { arquivos: xmls.length, notas, itens: itens.length, codigos: 0 } };
}

export default function NcmPelasNotasPage() {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'ler' | 'gravar'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [previa, setPrevia] = useState<NcmPreviaResultado | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [feito, setFeito] = useState<number | null>(null);

  const escolher = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setBusy('ler');
    setErr(null);
    setFeito(null);
    setPrevia(null);
    try {
      const { itens, leitura: l } = await lerArquivos(files);
      const porEan = juntarPorEan(itens);
      setLeitura({ ...l, codigos: porEan.length });
      if (!l.arquivos) throw new Error('Nenhum arquivo .xml entre os escolhidos');
      if (!porEan.length) throw new Error('Os XML não têm itens com código de barras e NCM (são notas de compra de NF-e?)');
      const r = await fetch('/api/products/ncm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: porEan }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(errorText(d, 'Não consegui comparar com o cadastro'));
      const p = d.data as NcmPreviaResultado;
      setPrevia(p);
      // já vêm marcados os produtos sem NCM; os que mudariam de NCM a dona marca se quiser
      setMarcados(new Set(p.linhas.filter((x) => x.situacao === 'novo').map((x) => x.productId)));
    } catch (e) {
      setErr(errorText(e, 'Não consegui ler as notas'));
    } finally {
      setBusy(null);
      if (filesRef.current) filesRef.current.value = '';
      if (folderRef.current) folderRef.current.value = '';
    }
  };

  const cont = useMemo(() => {
    const c = { novo: 0, diferente: 0, igual: 0 };
    for (const l of previa?.linhas ?? []) c[l.situacao]++;
    return c;
  }, [previa]);

  const gravar = async () => {
    if (!previa) return;
    const aplicar = previa.linhas
      .filter((l) => marcados.has(l.productId) && l.situacao !== 'igual')
      .map((l) => ({ productId: l.productId, ncm: l.ncmNota, cest: l.cestNota }));
    if (!aplicar.length) return;
    setBusy('gravar');
    setErr(null);
    try {
      const r = await fetch('/api/products/ncm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aplicar }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(errorText(d, 'Não consegui gravar'));
      setFeito(d.data.atualizados as number);
    } catch (e) {
      setErr(errorText(e, 'Não consegui gravar'));
    } finally {
      setBusy(null);
    }
  };

  const nMarcados = previa?.linhas.filter((l) => marcados.has(l.productId) && l.situacao !== 'igual').length ?? 0;
  const btn =
    'inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-medium disabled:opacity-50';

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow="Produtos"
          title="NCM pelas notas de compra"
          subtitle="Preenche o NCM de cada produto com o que veio nas notas dos fornecedores"
          actions={
            <Link href="/produtos" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Produtos
            </Link>
          }
        />

        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <FileCode2 className="h-8 w-8 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Escolha os XML das notas de compra</p>
            <p className="text-xs text-muted-foreground">
              Pode escolher vários arquivos ou a pasta inteira. Se o contador mandou um .zip, clique nele com o botão
              direito → &quot;Extrair tudo&quot; e escolha a pasta. O produto é achado pelo código de barras; nada é gravado
              antes de você conferir.
            </p>
          </div>
          <input ref={filesRef} type="file" multiple accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => escolher(e.target.files)} />
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => escolher(e.target.files)}
            {...({ webkitdirectory: '' } as Record<string, string>)}
          />
          <button type="button" onClick={() => folderRef.current?.click()} disabled={Boolean(busy)} className={`${btn} border border-border text-foreground hover:bg-muted`}>
            <FolderOpen className="h-4 w-4" /> Escolher pasta
          </button>
          <button type="button" onClick={() => filesRef.current?.click()} disabled={Boolean(busy)} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
            {busy === 'ler' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Escolher arquivos
          </button>
        </section>

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">{err}</div>}

        {leitura && (
          <p className="text-sm text-muted-foreground">
            {leitura.arquivos} arquivo(s) XML · {leitura.notas} nota(s) com itens · {leitura.codigos} código(s) de barras diferentes
            {previa && <> · {previa.semCadastro} não estão no cadastro</>}
          </p>
        )}

        {feito !== null ? (
          <section className="rounded-2xl border border-success/30 bg-success/10 p-6">
            <p className="flex items-center gap-2 font-heading text-xl text-foreground">
              <CheckCircle2 className="h-6 w-6 text-success" /> NCM gravado em {feito} produto(s)
            </p>
            <p className="mt-2 text-sm text-foreground">
              Os produtos que não estavam nas notas continuam sem NCM. Escolha mais notas ou preencha na tela de Produtos.
            </p>
            <Link href="/produtos" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Ver produtos
            </Link>
          </section>
        ) : (
          previa && (
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-sm">
                <span className="text-foreground">
                  <b>{cont.novo}</b> sem NCM hoje · <b>{cont.diferente}</b> com NCM diferente da nota · <b>{cont.igual}</b> já iguais
                </span>
                <span className="text-muted-foreground">
                  Depois de gravar, {Math.max(previa.continuamSemNcm, 0)} de {previa.totalProdutos} produtos ainda ficam sem NCM.
                </span>
                <button
                  type="button"
                  onClick={gravar}
                  disabled={Boolean(busy) || nMarcados === 0}
                  className={`${btn} ml-auto bg-primary text-primary-foreground hover:bg-primary/90`}
                >
                  {busy === 'gravar' && <Loader2 className="h-4 w-4 animate-spin" />} Gravar NCM em {nMarcados} produto(s)
                </button>
              </div>
              <NcmPreviewTable
                linhas={previa.linhas}
                marcados={marcados}
                onMarcar={(id, v) =>
                  setMarcados((s) => {
                    const n = new Set(s);
                    if (v) n.add(id);
                    else n.delete(id);
                    return n;
                  })
                }
              />
            </section>
          )
        )}
      </div>
    </Layout>
  );
}
