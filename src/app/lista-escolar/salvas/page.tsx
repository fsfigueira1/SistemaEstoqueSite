'use client';

// Listas escolares salvas: ver o código de cada lista (vai no botão do site
// e na mensagem do WhatsApp), desativar fora de época e excluir.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Trash2 } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import { errorText } from '@/lib/friendlyError';

type Summary = {
  id: string;
  code: string;
  schoolName: string;
  grade: string;
  schoolYear: number;
  itemCount: number;
  active: boolean;
  updatedAt: string;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default function ListasSalvasPage() {
  const [lists, setLists] = useState<Summary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/school-lists');
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui carregar as listas'));
      setLists(data.data);
    } catch (e) {
      setErr(errorText(e, 'Não consegui carregar as listas'));
      setLists([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (l: Summary) => {
    setErr(null);
    try {
      const r = await fetch(`/api/school-lists/${l.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !l.active }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui alterar'));
      setLists((ls) => ls?.map((x) => (x.id === l.id ? { ...x, active: !l.active } : x)) ?? null);
    } catch (e) {
      setErr(errorText(e, 'Não consegui alterar'));
    }
  };

  const remove = async (l: Summary) => {
    if (!window.confirm(`Excluir a lista "${l.schoolName} — ${l.grade} (${l.schoolYear})"? O código ${l.code} deixa de funcionar.`)) return;
    setErr(null);
    try {
      const r = await fetch(`/api/school-lists/${l.id}`, { method: 'DELETE' });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui excluir'));
      setLists((ls) => ls?.filter((x) => x.id !== l.id) ?? null);
    } catch (e) {
      setErr(errorText(e, 'Não consegui excluir'));
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copie o código:', code);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader eyebrow="Balcão" title="Listas salvas" subtitle="Listas de material por escola e série — o orçamento sai com o preço do dia" />

        <Link href="/lista-escolar" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar para a Lista escolar
        </Link>

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">{err}</div>}

        {lists && lists.length === 0 && !err && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma lista salva ainda — monte um orçamento na Lista escolar e clique em Salvar.
          </div>
        )}

        {lists && lists.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Escola</th>
                    <th className="px-2 py-2.5 font-semibold">Série</th>
                    <th className="px-2 py-2.5 font-semibold">Ano</th>
                    <th className="px-2 py-2.5 font-semibold">Código</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Itens</th>
                    <th className="px-2 py-2.5 font-semibold">Atualizada</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Ativa</th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lists.map((l) => (
                    <tr key={l.id} className={l.active ? '' : 'opacity-60'}>
                      <td className="px-4 py-2.5 font-medium text-foreground">{l.schoolName}</td>
                      <td className="px-2 py-2.5">{l.grade}</td>
                      <td className="px-2 py-2.5 tabular-nums">{l.schoolYear}</td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => copy(l.code)}
                          title="Copiar código"
                          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono tracking-wider hover:bg-muted"
                        >
                          {l.code}
                          {copied === l.code ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{l.itemCount}</td>
                      <td className="px-2 py-2.5 text-muted-foreground">{fmtDate(l.updatedAt)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={l.active}
                          onChange={() => toggle(l)}
                          aria-label={l.active ? 'Desativar lista' : 'Ativar lista'}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" onClick={() => remove(l)} title="Excluir" className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
