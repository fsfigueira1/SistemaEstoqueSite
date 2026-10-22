'use client';

// Novidades → Importar planilha: colar as colunas do Excel (nome + telefone)
// ou escolher um CSV. Mostra a prévia antes de gravar.

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/lib/friendlyError';

type Preview = { rows: Array<{ name: string; phone: string }>; invalid: Array<{ line: number; raw: string }>; novos: number; existentes: number };

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui ler a planilha'));
  return data.data;
}

const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

export default function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText('');
    setPreview(null);
    setErr(null);
  };

  const check = async (t = text) => {
    setBusy(true);
    setErr(null);
    try {
      setPreview(await post('/api/contacts/import', { text: t }));
    } catch (e) {
      setPreview(null);
      setErr(errorText(e, 'Não consegui ler a planilha'));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await post('/api/contacts/import', { text, commit: true });
      onDone(`${r.criados} novos e ${r.atualizados} já existentes atualizados`);
      reset();
      onOpenChange(false);
    } catch (e) {
      setErr(errorText(e, 'Não consegui importar'));
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    const t = await f.text();
    setText(t);
    await check(t);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar planilha de contatos</DialogTitle>
          <DialogDescription>
            No Excel, selecione as colunas de nome e telefone, copie (Ctrl+C) e cole aqui. Também aceita arquivo CSV. Quem entrar
            por aqui passa a receber novidades.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          rows={7}
          placeholder={'Nome\tTelefone\nAna Souza\t(17) 99999-8888\nBeto\t17 98888-7777'}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            <FileUp className="h-4 w-4 text-primary" /> Escolher CSV
          </button>
          <button
            type="button"
            onClick={() => check()}
            disabled={busy || !text.trim()}
            className="ml-auto rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Conferir
          </button>
        </div>

        {preview && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <p>
              <strong>{preview.rows.length}</strong> contatos válidos — {preview.novos} novos, {preview.existentes} já cadastrados
              {preview.invalid.length > 0 && <> · <span className="text-danger">{preview.invalid.length} com telefone inválido</span></>}
            </p>
            <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
              {preview.rows.slice(0, 8).map((r) => (
                <li key={r.phone}>
                  {r.name || 'Sem nome'} · {fmtPhone(r.phone)}
                </li>
              ))}
              {preview.rows.length > 8 && <li>… e mais {preview.rows.length - 8}</li>}
            </ul>
            {preview.invalid.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-danger">Ver linhas com telefone inválido</summary>
                <ul className="mt-1 max-h-24 overflow-y-auto font-mono">
                  {preview.invalid.map((i) => (
                    <li key={i.line}>
                      linha {i.line}: {i.raw}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {err && <p className="text-sm font-medium text-danger">{err}</p>}

        <DialogFooter>
          <button
            type="button"
            onClick={commit}
            disabled={busy || !preview}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Importar {preview ? preview.rows.length : ''} contatos
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
