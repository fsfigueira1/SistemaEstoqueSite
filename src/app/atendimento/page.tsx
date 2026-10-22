'use client';

// Atendimento (copiloto). Duas formas:
// - WhatsApp (só no aplicativo do balcão): o WhatsApp Web fica dentro da tela;
//   "Gerar resposta" lê a conversa aberta e "Colocar no WhatsApp" escreve a
//   resposta na caixa — quem aperta Enter é o atendente.
// - Colar mensagem: cola o que o cliente mandou e copia a resposta.
// Orçamento montado fica salvo em Orçamentos pedidos; resposta aprovada ensina
// o jeito da loja para a IA.

import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import WhatsAppPane from '@/components/atendimento/WhatsAppPane';
import ReplyPanel, { type Draft } from '@/components/atendimento/ReplyPanel';
import LearnedExamples from '@/components/atendimento/LearnedExamples';
import { errorText } from '@/lib/friendlyError';
import { whatsappNumber } from '@/lib/restock';
import { waLink } from '@/lib/contacts';
import { WA_REASON, customerTurn, whatsappBridge } from '@/lib/whatsappBridge';

type Mode = 'whatsapp' | 'colar';

export default function AtendimentoPage() {
  const [hasWa, setHasWa] = useState(false);
  const [mode, setMode] = useState<Mode>('colar');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reply, setReply] = useState('');
  const [learned, setLearned] = useState(0);

  useEffect(() => {
    const ok = Boolean(whatsappBridge());
    setHasWa(ok);
    if (ok) setMode('whatsapp');
  }, []);

  const ask = async (n: string, p: string, t: string) => {
    // gerar de novo para o mesmo cliente substitui o orçamento (não duplica)
    const replaceId = draft?.quoteRequestId ?? null;
    setDraft(null);
    const r = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, phone: p, text: t, replaceId }),
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui montar a resposta'));
    setDraft(data.data);
    setReply(data.data.reply);
  };

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'whatsapp') {
        const chat = await whatsappBridge()?.read();
        if (!chat || !chat.ok) throw new Error(WA_REASON[chat?.reason ?? 'erro']);
        const t = customerTurn(chat.messages);
        if (!t.trim()) throw new Error('O cliente ainda não mandou mensagem nova depois da última resposta da loja.');
        setName(chat.name);
        setPhone(chat.phone);
        setText(t);
        await ask(chat.name, chat.phone, t);
      } else {
        await ask(name, phone, text);
      }
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
    setReply('');
    setErr(null);
  };

  const wa = whatsappNumber(phone);
  const inp = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm';
  const tabCls = (m: Mode) => `rounded-lg px-4 py-2 text-sm font-medium ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`;

  const fields = (
    <>
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
        rows={mode === 'whatsapp' ? 4 : 12}
        maxLength={8000}
        placeholder={
          mode === 'whatsapp'
            ? 'O que o cliente mandou aparece aqui ao gerar (dá para corrigir).'
            : 'Cole aqui o que o cliente mandou. Ex.:\n2 cadernos 96 folhas\n3 lápis preto\n1 borracha\n\nTambém vale o pedido que vem do site e perguntas ("que horas abre?").'
        }
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed"
      />
    </>
  );

  const generateButton = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{mode === 'whatsapp' ? 'Abra a conversa do cliente ao lado e clique.' : 'Foto de lista? Leia na Lista escolar e cole o texto.'}</p>
      <button
        type="button"
        onClick={generate}
        disabled={busy || (mode === 'colar' && !text.trim())}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Gerar resposta
      </button>
    </div>
  );

  const replyPanel = (
    <ReplyPanel
      draft={draft}
      reply={reply}
      setReply={setReply}
      waLinkHref={mode === 'colar' && wa ? waLink(wa, reply) : null}
      onInsert={mode === 'whatsapp' ? async () => Boolean(await whatsappBridge()?.insert(reply)) : undefined}
      onApproved={approved}
      onNext={nextClient}
    />
  );

  return (
    <Layout>
      <div className="mx-auto max-w-[1400px] space-y-4 p-6">
        <PageHeader eyebrow="Balcão" title="Atendimento" subtitle="A resposta e o orçamento saem prontos — você confere e envia" />

        <div className="flex gap-2">
          <button type="button" className={tabCls('whatsapp')} onClick={() => setMode('whatsapp')}>
            WhatsApp
          </button>
          <button type="button" className={tabCls('colar')} onClick={() => setMode('colar')}>
            Colar mensagem
          </button>
        </div>

        {mode === 'whatsapp' && !hasWa ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            O WhatsApp dentro do sistema só funciona no aplicativo do PC do balcão. Aqui, use a aba <strong>Colar mensagem</strong>.
          </div>
        ) : mode === 'whatsapp' ? (
          <div className="grid h-[calc(100vh-14rem)] min-h-[520px] gap-4 lg:grid-cols-[1.4fr_1fr]">
            <WhatsAppPane />
            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                {generateButton}
                {err && <p className="text-sm font-medium text-danger">{err}</p>}
                {fields}
              </section>
              {replyPanel}
              <LearnedExamples refreshKey={learned} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg text-foreground">Mensagem do cliente</h2>
                {fields}
                {generateButton}
                {busy && <p className="text-xs text-muted-foreground">Montando… a IA pode levar até 1 minuto.</p>}
                {err && <p className="text-sm font-medium text-danger">{err}</p>}
              </section>
              {replyPanel}
            </div>
            <LearnedExamples refreshKey={learned} />
          </>
        )}
      </div>
    </Layout>
  );
}
