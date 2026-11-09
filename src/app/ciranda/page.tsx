'use client';

// Ciranda (APM): quem mandou pelo WhatsApp o comprovante do Pix e os dados da
// criança. É o que o cliente enviou; a confirmação do dinheiro é no banco.

import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import { errorText } from '@/lib/friendlyError';

type Row = {
  id: string;
  contactName: string;
  phone: string;
  childName: string;
  schoolGrade: string;
  guardianName: string;
  hasReceipt: boolean;
  receiptInfo: string;
  createdAt: string;
  missing: string[];
};

const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const csvCell = (v: string) => `"${v.replace(/"/g, '""').replace(/\s*\n\s*/g, ' | ')}"`;

async function api(url: string) {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui carregar'));
  return data.data;
}

function download(rows: Row[]) {
  const head = ['Criança', 'Ano escolar', 'Responsável', 'Comprovante', 'Situação', 'Lido no comprovante', 'WhatsApp', 'Contato', 'Recebido em'];
  const body = rows.map((r) =>
    [r.childName, r.schoolGrade, r.guardianName, r.hasReceipt ? 'Sim' : 'Não', r.missing.length ? `Falta ${r.missing.join(', ')}` : 'Completo', r.receiptInfo, fmtPhone(r.phone), r.contactName, fmtDate(r.createdAt)].map(csvCell).join(';'),
  );
  const url = URL.createObjectURL(new Blob([`${String.fromCharCode(0xfeff)}${[head.join(';'), ...body].join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ciranda-pagamentos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function CirandaPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    api('/api/ciranda')
      .then(setRows)
      .catch((e) => {
        setErr(errorText(e, 'Não consegui carregar'));
        setRows([]);
      });
  }, []);

  const done = useMemo(() => (rows ?? []).filter((r) => !r.missing.length).length, [rows]);

  const openPhoto = async (id: string) => {
    setErr(null);
    try {
      setPhoto(await api(`/api/ciranda/${id}`));
    } catch (e) {
      setErr(errorText(e, 'Não consegui abrir o comprovante'));
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader eyebrow="APM" title="Ciranda: pagamentos por Pix" subtitle="Quem mandou o comprovante e os dados pelo WhatsApp. Confirme o valor no banco." />

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">{err}</div>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{rows ? `${done} completo${done === 1 ? '' : 's'} de ${rows.length}` : ''}</p>
          <button type="button" disabled={!rows?.length} onClick={() => rows && download(rows)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Download className="h-4 w-4" /> Baixar planilha
          </button>
        </div>

        <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          {rows === null ? (
            <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum comprovante ainda. Eles aparecem aqui quando chegam pelo WhatsApp.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Criança</th>
                  <th className="px-4 py-3">Ano</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Recebido</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Comprovante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{r.childName || '—'}</td>
                    <td className="px-4 py-3">{r.schoolGrade || '—'}</td>
                    <td className="px-4 py-3">{r.guardianName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="block">{fmtPhone(r.phone) || '—'}</span>
                      <span className="block text-xs text-muted-foreground">{r.contactName}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3">{r.missing.length ? <span className="pill pill-warn" title={r.missing.join(', ')}>Falta {r.missing.length}</span> : <span className="pill pill-ok">Completo</span>}</td>
                    <td className="px-4 py-3">
                      {r.hasReceipt ? (
                        <button type="button" onClick={() => openPhoto(r.id)} title={r.receiptInfo} className="font-medium text-primary hover:underline">
                          Ver foto
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {photo && (
        <div role="dialog" aria-modal="true" aria-label="Comprovante" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPhoto(null)}>
          <button type="button" aria-label="Fechar" className="absolute right-4 top-4 rounded-full bg-card p-2" onClick={() => setPhoto(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={photo} alt="Comprovante do Pix" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </Layout>
  );
}
