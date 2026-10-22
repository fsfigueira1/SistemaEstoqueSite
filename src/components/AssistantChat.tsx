'use client';

// Ajudante com IA (NVIDIA): conversa sobre vendas, estoque e ideias de texto.
// Só lê os dados da loja — não altera nada. Abre de qualquer tela com
// openAssistantChat(); a tela Novidades pede "Usar este texto" e recebe a
// resposta pelo evento USE_EVENT. A conversa fica só na memória desta tela.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Loader2, RotateCcw, Send, X } from 'lucide-react';
import { loadSettings } from '@/lib/settings';
import { errorText } from '@/lib/friendlyError';

const OPEN_EVENT = 'lacolaria:assistant-chat';
export const USE_EVENT = 'lacolaria:assistant-use';

type OpenDetail = { prompt?: string; offerUse?: boolean };
type Msg = { role: 'user' | 'assistant'; content: string };

/** Abre o ajudante (opcional: já manda uma pergunta; offerUse mostra "Usar este texto"). */
export function openAssistantChat(detail: OpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

/** Pares pergunta/resposta completos (a rota exige alternância). */
function pairs(msgs: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (let i = 0; i + 1 < msgs.length; i += 2) {
    if (msgs[i].role === 'user' && msgs[i + 1].role === 'assistant' && msgs[i + 1].content) out.push(msgs[i], msgs[i + 1]);
  }
  return out;
}

const SUGGESTIONS = ['Quanto vendi essa semana?', 'O que está acabando no estoque?', 'Quais os mais vendidos do mês?', 'Ideia de novidade com o que tem em estoque'];

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [keySet, setKeySet] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [offerUse, setOfferUse] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(async (question: string, history: Msg[]) => {
    const q = question.trim();
    if (!q) return;
    const next: Msg[] = [...history, { role: 'user', content: q }];
    setMsgs([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-20) }),
        signal: ctrl.signal,
      });
      if (!r.ok || !r.body) {
        const data = await r.json().catch(() => null);
        throw new Error(errorText(data, 'O ajudante não respondeu'));
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMsgs([...next, { role: 'assistant', content: text }]);
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setMsgs([...next, { role: 'assistant', content: errorText(e, 'O ajudante não respondeu, tente de novo.') }]);
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<OpenDetail>).detail ?? {};
      setOpen(true);
      setOfferUse(Boolean(d.offerUse));
      loadSettings()
        .then((s) => {
          const ok = Boolean(s.nvidiaKeySet);
          setKeySet(ok);
          if (ok && d.prompt) ask(d.prompt, []);
        })
        .catch(() => setKeySet(false));
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [ask]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  const reset = () => {
    abort.current?.abort();
    setBusy(false);
    setMsgs([]);
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-label="Ajudante" className="fixed bottom-5 right-5 z-50 flex h-[min(36rem,calc(100vh-2.5rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 border-b border-border bg-bow-soft/60 px-4 py-3">
        <span className="rounded-lg bg-white p-1.5 text-primary ring-1 ring-black/5">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-bow">Ajudante</p>
          <p className="text-sm text-muted-foreground">Vendas, estoque e ideias de texto</p>
        </div>
        {msgs.length > 0 && (
          <button onClick={reset} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Nova conversa" title="Nova conversa">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {keySet === false ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-foreground">Para usar o ajudante, cadastre a chave da NVIDIA.</p>
            <Link href="/configuracoes" onClick={() => setOpen(false)} className="mt-1 inline-block text-primary hover:underline">
              Ir para Configurações → Inteligência artificial
            </Link>
          </div>
        ) : msgs.length === 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">Pergunte sobre as vendas e o estoque da loja. Eu só leio os dados — não altero nada.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s, [])} disabled={keySet !== true} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {m.content || (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Pensando… (pode levar até 1 minuto)
                  </span>
                )}
                {m.role === 'assistant' && offerUse && m.content && !(busy && i === msgs.length - 1) && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent<string>(USE_EVENT, { detail: m.content }));
                      reset();
                      setOpen(false);
                    }}
                    className="mt-2 block rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-primary hover:bg-muted"
                  >
                    Usar este texto
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) ask(input, pairs(msgs));
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          disabled={keySet !== true}
          placeholder="Escreva sua pergunta…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm disabled:opacity-50"
        />
        <button type="submit" disabled={busy || !input.trim() || keySet !== true} className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-50" aria-label="Enviar">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
