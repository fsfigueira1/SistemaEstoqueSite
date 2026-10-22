'use client';

// Resposta pronta do copiloto: editável, com o selo do orçamento salvo e as
// ações. Nenhuma ação envia mensagem — "Colocar no WhatsApp" só escreve na
// caixa da conversa; quem aperta Enter é o atendente. Copiar/colocar conta como
// resposta aprovada (a IA aprende o jeito da loja).

import { useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCheck, Copy, MessageCircle, SendHorizonal } from 'lucide-react';

export type Draft = { reply: string; intent: 'site' | 'code' | 'list' | 'other'; quoteRequestId: string | null; total: number | null };

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const INTENT: Record<Draft['intent'], string> = { site: 'Pedido do site', code: 'Lista salva', list: 'Lista de material', other: 'Mensagem comum' };

export default function ReplyPanel({
  draft,
  reply,
  setReply,
  waLinkHref,
  onInsert,
  onApproved,
  onNext,
}: {
  draft: Draft | null;
  reply: string;
  setReply: (v: string) => void;
  /** modo colar com telefone válido: link wa.me */
  waLinkHref?: string | null;
  /** modo WhatsApp: escreve na caixa da conversa aberta */
  onInsert?: () => Promise<boolean>;
  onApproved: () => void;
  onNext: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState<null | boolean>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie a resposta:', reply);
    }
    onApproved();
  };

  const insert = async () => {
    if (!onInsert) return;
    const ok = await onInsert();
    setInserted(ok);
    if (ok) onApproved();
  };

  return (
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
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={12} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed" />
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {inserted === true
              ? 'Pronto — confira na conversa e aperte Enter no WhatsApp.'
              : inserted === false
                ? 'Não achei a caixa de mensagem. Abra a conversa no WhatsApp ou use Copiar.'
                : 'Confira antes de enviar — quem envia é você.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {onInsert && (
              <button type="button" onClick={insert} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <SendHorizonal className="h-4 w-4" /> Colocar no WhatsApp
              </button>
            )}
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiada' : 'Copiar resposta'}
            </button>
            {waLinkHref && (
              <a href={waLinkHref} onClick={onApproved} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
                <MessageCircle className="h-4 w-4 text-primary" /> Abrir no WhatsApp
              </a>
            )}
            <button type="button" onClick={onNext} className="ml-auto rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              Próximo cliente
            </button>
          </div>
        </>
      )}
    </section>
  );
}
