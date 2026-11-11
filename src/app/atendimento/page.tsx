'use client';

// Atendimento: o WhatsApp Web fica dentro da tela (aplicativo do balcão) e o
// agente Nemotron responde sozinho. Ao lado: painel "IA hoje" com a última
// conversa do agente, o liga/desliga do robô, "Responder à mão com a IA"
// (lê a conversa aberta; quem aperta Enter é o atendente), "Chamando de volta"
// e as respostas que ensinaram a IA. Fora do aplicativo (navegador) dá para
// acompanhar a IA, mas o WhatsApp só abre no PC do balcão.
// Orçamento montado fica salvo em Orçamentos; resposta aprovada ensina o jeito da loja.

import { useEffect, useState } from 'react';
import { Loader2, MonitorSmartphone, Sparkles } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import AtendimentoTabs from '@/components/atendimento/AtendimentoTabs';
import WhatsAppPane from '@/components/atendimento/WhatsAppPane';
import ReplyPanel, { type Draft } from '@/components/atendimento/ReplyPanel';
import LearnedExamples from '@/components/atendimento/LearnedExamples';
import AutoReplyPanel from '@/components/atendimento/AutoReplyPanel';
import AgentToday from '@/components/atendimento/AgentToday';
import WinbackBoard from '@/components/atendimento/WinbackBoard';
import { errorText } from '@/lib/friendlyError';
import { WA_REASON, customerTurn, sameCustomer, whatsappBridge } from '@/lib/whatsappBridge';

export default function AtendimentoPage() {
  const [hasWa, setHasWa] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** cliente para quem a resposta atual foi gerada (como veio da conversa) */
  const [draftFor, setDraftFor] = useState<{ name: string; phone: string } | null>(null);
  const [reply, setReply] = useState('');
  const [learned, setLearned] = useState(0);

  useEffect(() => {
    setHasWa(Boolean(whatsappBridge()));
  }, []);

  const ask = async (n: string, p: string, t: string) => {
    // gerar de novo para o MESMO cliente substitui o orçamento (não duplica);
    // outro cliente ganha um orçamento novo
    const who = { name: n, phone: p };
    const replaceId = draft?.quoteRequestId && draftFor && sameCustomer(draftFor, who) ? draft.quoteRequestId : null;
    setDraft(null);
    const r = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, phone: p, text: t, replaceId }),
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui montar a resposta'));
    setDraft(data.data);
    setDraftFor(who);
    setReply(data.data.reply);
  };

  /** Lê o que o cliente mandou na conversa aberta e gera a resposta. */
  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const chat = await whatsappBridge()?.read();
      if (!chat || !chat.ok) throw new Error(WA_REASON[chat?.reason ?? 'erro']);
      const t = customerTurn(chat.messages);
      if (!t.trim()) throw new Error('O cliente ainda não mandou mensagem nova depois da última resposta da loja.');
      setName(chat.name);
      setPhone(chat.phone);
      setText(t);
      await ask(chat.name, chat.phone, t);
    } catch (e) {
      setErr(errorText(e, 'Não consegui montar a resposta'));
    } finally {
      setBusy(false);
    }
  };

  /** Corrigiu o que o cliente mandou: gera de novo com o texto corrigido. */
  const regenerate = async () => {
    setBusy(true);
    setErr(null);
    try {
      await ask(name, phone, text);
    } catch (e) {
      setErr(errorText(e, 'Não consegui montar a resposta'));
    } finally {
      setBusy(false);
    }
  };

  const approved = () => {
    if (!draft || !reply.trim()) return;
    fetch('/api/copilot/examples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerText: text, aiReply: draft.reply, finalReply: reply }),
    })
      .then(() => setLearned((n) => n + 1))
      .catch(() => {});
  };

  const nextClient = () => {
    setName('');
    setPhone('');
    setText('');
    setDraft(null);
    setDraftFor(null);
    setReply('');
    setErr(null);
  };

  const insert = async () => {
    const r = await whatsappBridge()?.insert(reply, draftFor ?? { name: '', phone: '' });
    if (r?.ok) return { ok: true };
    return {
      ok: false,
      message:
        r?.reason === 'outra-conversa'
          ? `A conversa aberta não é a de ${draftFor?.name || 'quem pediu esta resposta'}. Volte para a conversa certa e clique de novo.`
          : 'Não achei a caixa de mensagem. Abra a conversa no WhatsApp ou use Copiar.',
    };
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1400px] space-y-4 p-6">
        <PageHeader eyebrow="Balcão" title="Atendimento" subtitle="O agente de IA responde o WhatsApp sozinho — você acompanha e entra quando ele chamar" />
        <AtendimentoTabs />

        {hasWa === false ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                <MonitorSmartphone className="h-5 w-5 shrink-0 text-primary" />
                <p>
                  O WhatsApp abre dentro do sistema só no <strong className="text-foreground">aplicativo do PC do balcão</strong>. Por aqui você
                  acompanha o que a IA está fazendo.
                </p>
              </div>
              <AgentToday refreshKey={learned} />
            </div>
            <WinbackBoard />
          </div>
        ) : hasWa ? (
          <div className="grid h-[calc(100vh-12rem)] min-h-[520px] gap-4 lg:grid-cols-[1.4fr_1fr]">
            <WhatsAppPane />
            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              <AgentToday refreshKey={learned} />
              <AutoReplyPanel />
              <details className="rounded-2xl border border-border bg-card shadow-sm">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                  Responder à mão com a IA <span className="text-xs text-muted-foreground">(gera, você confere e envia)</span>
                </summary>
                <div className="space-y-3 border-t border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Abra a conversa do cliente ao lado e clique.</p>
                    <button
                      type="button"
                      onClick={generate}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Gerar resposta
                    </button>
                  </div>
                  {busy && <p className="text-xs text-muted-foreground">Montando… a IA pode levar até 1 minuto.</p>}
                  {err && <p className="text-sm font-medium text-danger">{err}</p>}
                  {(name || phone || text) && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Cliente: <span className="font-medium text-foreground">{name || phone || 'sem nome'}</span>
                      </p>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={4}
                        maxLength={8000}
                        aria-label="O que o cliente mandou"
                        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed"
                      />
                      <button type="button" onClick={regenerate} disabled={busy || !text.trim()} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
                        Corrigi o texto — gerar de novo
                      </button>
                    </div>
                  )}
                  <ReplyPanel draft={draft} reply={reply} setReply={setReply} waLinkHref={null} onInsert={insert} onApproved={approved} onNext={nextClient} />
                </div>
              </details>
              <WinbackBoard />
              <LearnedExamples refreshKey={learned} />
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
