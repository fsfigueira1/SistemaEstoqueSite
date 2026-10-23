'use client';

// Novidades → Enviar: escreve a mensagem, cria o envio para quem recebe
// novidades e ajuda a mandar pelo WhatsApp Business do celular — lista de
// transmissão (.vcf + mensagem copiada) ou um por um (link pronto por contato).

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, MessageCircle, Send } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';
import { personalize, waLink, withFooter } from '@/lib/contacts';

type Summary = { id: string; text: string; createdAt: string; total: number; sent: number };
type Detail = {
  id: string;
  text: string;
  message: string;
  createdAt: string;
  recipients: Array<{ contactId: string; name: string | null; phone: string; sentAt: string | null; saiu: boolean }>;
};

const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

async function api(url: string, method = 'GET', body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui salvar'));
  return data.data;
}

export default function SendTab({ activeCount, draft, onDraftUsed, onAskHelper }: {
  activeCount: number;
  /** texto vindo do ajudante ("Usar este texto") */
  draft?: string | null;
  onDraftUsed?: () => void;
  onAskHelper?: () => void;
}) {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<Summary[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (draft) {
      setText(draft);
      onDraftUsed?.();
    }
  }, [draft, onDraftUsed]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api('/api/broadcasts'));
    } catch {
      /* histórico é secundário */
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openBroadcast = async (id: string) => {
    setErr(null);
    try {
      setOpen(await api(`/api/broadcasts/${id}`));
    } catch (e) {
      setErr(errorText(e, 'Não consegui abrir o envio'));
    }
  };

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api('/api/broadcasts', 'POST', { text });
      setText('');
      await openBroadcast(r.id);
      loadHistory();
    } catch (e) {
      setErr(errorText(e, 'Não consegui criar o envio'));
    } finally {
      setBusy(false);
    }
  };

  const mark = async (contactId: string, sent: boolean) => {
    if (!open) return;
    setOpen({ ...open, recipients: open.recipients.map((r) => (r.contactId === contactId ? { ...r, sentAt: sent ? new Date().toISOString() : null } : r)) });
    try {
      await api(`/api/broadcasts/${open.id}/recipients/${contactId}`, 'PATCH', { sent });
      loadHistory();
    } catch (e) {
      setErr(errorText(e, 'Não consegui marcar'));
    }
  };

  const copyMessage = async (msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie a mensagem:', msg);
    }
  };

  const preview = text.trim() ? withFooter(personalize(text, 'Ana')) : '';
  const sentCount = open?.recipients.filter((r) => r.sentAt).length ?? 0;
  const pending = open?.recipients.filter((r) => !r.saiu) ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg text-foreground">Nova novidade</h2>
          {onAskHelper && (
            <button type="button" onClick={onAskHelper} className="text-sm text-primary hover:underline">
              Sugerir texto com o ajudante
            </button>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={'Ex.: Olá, {nome}! Chegaram os cadernos 2027 e as mochilas novas. Passa aqui pra ver! 📚'}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed"
          />
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Prévia (para a Ana)</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{preview || <span className="text-muted-foreground">Escreva a mensagem ao lado. Use {'{nome}'} para o primeiro nome do cliente.</span>}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            O aviso “Para não receber mais, responda SAIR.” vai sempre no fim. Quem responder SAIR no celular: marque como “Saiu” em Contatos.
          </p>
          <button
            type="button"
            onClick={create}
            disabled={busy || !text.trim() || activeCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Criar envio para {activeCount} {activeCount === 1 ? 'contato' : 'contatos'}
          </button>
        </div>
        {err && <p className="text-sm font-medium text-danger">{err}</p>}
      </section>

      {open && (
        <section className="space-y-4 rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg text-foreground">Envio de {fmtDate(open.createdAt)}</h2>
            <p className="text-sm tabular-nums text-muted-foreground">
              {sentCount} de {open.recipients.length} enviados
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border p-4">
              <h3 className="font-medium text-foreground">1. Lista de transmissão (mais rápido)</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Baixe os contatos e abra o arquivo no celular para salvá-los.</li>
                <li>No WhatsApp Business: Conversas → ⋮ → Nova transmissão → escolha os contatos (até 256 por lista).</li>
                <li>Cole a mensagem e envie. Só recebe quem tem o número da loja salvo.</li>
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`/api/broadcasts/${open.id}/vcf`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
                  <Download className="h-4 w-4 text-primary" /> Baixar contatos (.vcf)
                </a>
                <button type="button" onClick={() => copyMessage(personalize(open.message, null))} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiada' : 'Copiar mensagem'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Na lista de transmissão não dá para pôr o nome de cada um: o {'{nome}'} sai do texto copiado.</p>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-4">
              <h3 className="font-medium text-foreground">2. Um por um (com o nome de cada cliente)</h3>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {open.recipients.map((r) => (
                  <li key={r.contactId} className={`flex items-center gap-2 py-1.5 text-sm ${r.saiu ? 'text-muted-foreground line-through' : ''}`}>
                    <input type="checkbox" checked={Boolean(r.sentAt)} disabled={r.saiu} onChange={(e) => mark(r.contactId, e.target.checked)} aria-label="Enviado" className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate">
                      {r.name || 'Sem nome'} <span className="text-xs text-muted-foreground">{fmtPhone(r.phone)}</span>
                    </span>
                    {r.saiu ? (
                      <span className="text-xs no-underline">saiu</span>
                    ) : (
                      <a
                        href={waLink(r.phone, personalize(open.message, r.name))}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => !r.sentAt && mark(r.contactId, true)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-primary" /> Abrir no WhatsApp
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {pending.length === 0 && <p className="text-xs text-muted-foreground">Todos os destinatários saíram.</p>}
            </div>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-lg text-foreground">Envios anteriores</h2>
          <ul className="divide-y divide-border text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDate(h.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate">{h.text}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {h.sent}/{h.total}
                </span>
                <button type="button" onClick={() => openBroadcast(h.id)} className="text-xs text-primary hover:underline">
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
