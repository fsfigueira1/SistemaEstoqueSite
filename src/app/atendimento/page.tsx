'use client';

// Atendimento (copiloto): cole a mensagem que o cliente mandou no WhatsApp e
// receba a resposta pronta — com o orçamento montado pelo estoque quando for
// pedido de lista. Quem envia é sempre o atendente (Copiar / Abrir no
// WhatsApp). Orçamento montado já fica salvo em Orçamentos pedidos.

import { useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCheck, Copy, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import { errorText } from '@/lib/friendlyError';
import { whatsappNumber } from '@/lib/restock';
import { waLink } from '@/lib/contacts';

type Draft = { reply: string; intent: 'site' | 'code' | 'list' | 'other'; quoteRequestId: string | null; total: number | null };

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const INTENT: Record<Draft['intent'], string> = {
  site: 'Pedido do site',
  code: 'Lista salva',
  list: 'Lista de material',
  other: 'Mensagem comum',
};

export default function AtendimentoPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    // gerar de novo para o mesmo cliente substitui o orçamento (não duplica)
    const replaceId = draft?.quoteRequestId ?? null;
    setDraft(null);
    try {
      const r = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, text, replaceId }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui montar a resposta'));
      setDraft(data.data);
      setReply(data.data.reply);
    } catch (e) {
      setErr(errorText(e, 'Não consegui montar a resposta'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie a resposta:', reply);
    }
  };

  const nextClient = () => {
    setName('');
    setPhone('');
    setText('');
    setDraft(null);
    setReply('');
    setErr(null);
  };

  const wa = whatsappNumber(phone);
  const inp = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm';

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader eyebrow="Balcão" title="Atendimento" subtitle="Cole a mensagem do cliente do WhatsApp — a resposta e o orçamento saem prontos para você conferir e enviar" />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg text-foreground">Mensagem do cliente</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Nome</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Souza" className={inp} maxLength={120} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">WhatsApp</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(17) 99999-8888" inputMode="tel" className={inp} />
              </label>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              maxLength={8000}
              placeholder={'Cole aqui o que o cliente mandou. Ex.:\n2 cadernos 96 folhas\n3 lápis preto\n1 borracha\n\nTambém vale o pedido que vem do site e perguntas ("que horas abre?").'}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Foto de lista? Use a leitura de foto da Lista escolar e cole o texto aqui.</p>
              <button
                type="button"
                onClick={generate}
                disabled={busy || !text.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar resposta
              </button>
            </div>
            {busy && <p className="text-xs text-muted-foreground">Montando… a IA pode levar até 1 minuto.</p>}
            {err && <p className="text-sm font-medium text-danger">{err}</p>}
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg text-foreground">Resposta</h2>
              {draft && <span className="pill pill-muted">{INTENT[draft.intent]}</span>}
            </div>
            {!draft ? (
              <p className="text-sm text-muted-foreground">A resposta aparece aqui. Você pode editar antes de enviar.</p>
            ) : (
              <>
                {draft.quoteRequestId && (
                  <Link href={`/orcamentos?id=${draft.quoteRequestId}`} className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success hover:underline">
                    <ClipboardCheck className="h-4 w-4" /> Orçamento salvo{draft.total != null ? ` — ${brl(draft.total)}` : ''}
                  </Link>
                )}
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={14} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed" />
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Confira antes de enviar — quem envia é você.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiada' : 'Copiar resposta'}
                  </button>
                  {wa && (
                    <a href={waLink(wa, reply)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
                      <MessageCircle className="h-4 w-4 text-primary" /> Abrir no WhatsApp
                    </a>
                  )}
                  <button type="button" onClick={nextClient} className="ml-auto rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                    Próximo cliente
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
