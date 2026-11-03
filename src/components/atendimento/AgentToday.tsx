'use client';

// Topo do Atendimento: painel "IA hoje" (atendimentos do agente, orçamentos e
// vendas do dia) e a conversa mais recente do agente "ao vivo" — cliente,
// passos que a IA fez e a resposta. Dados de /api/agent/today.

import { useCallback, useEffect, useState } from 'react';
import { Hand, MessageCircle, Sparkles } from 'lucide-react';
import { Avatar, Bubble, Card, ChatArea, StepChips, hhmm } from '@/components/atendimento/agentUi';

type Ev = {
  id: string;
  kind: 'reply' | 'handoff' | 'optout' | 'winback';
  name: string;
  steps: string[];
  customerText: string;
  reply: string;
  reason: string;
  status: string;
  at: string;
  sentAt: string | null;
};
type Today = {
  ai: { replies: number; handoffs: number; winbacks: number };
  quotes: { count: number; total: number };
  /** null para o balcão (faturamento é só do dono) */
  sales: { count: number; total: number } | null;
  recent: Ev[];
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-heading text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AgentToday({ refreshKey = 0 }: { refreshKey?: number }) {
  const [d, setD] = useState<Today | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/agent/today').catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    if (j?.success) setD(j.data);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  if (!d) return null;
  const ev = d.recent.find((e) => e.id === pick) ?? d.recent[0];

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">IA hoje</p>
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Stat value={String(d.ai.replies)} label="Atendimentos da IA" />
          {d.sales ? (
            <Stat value={money.format(d.sales.total)} label={`Vendas hoje (${d.sales.count})`} />
          ) : (
            <Stat value={String(d.ai.handoffs)} label="Passadas para você" />
          )}
          <Stat value={String(d.quotes.count)} label="Orçamentos montados" />
          <Stat value={money.format(d.quotes.total)} label="Valor orçado" />
        </div>
        {(d.ai.handoffs > 0 || d.ai.winbacks > 0) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {d.ai.handoffs > 0 && `${d.ai.handoffs} passada${d.ai.handoffs > 1 ? 's' : ''} para você`}
            {d.ai.handoffs > 0 && d.ai.winbacks > 0 && ' · '}
            {d.ai.winbacks > 0 && `${d.ai.winbacks} cliente${d.ai.winbacks > 1 ? 's' : ''} chamado${d.ai.winbacks > 1 ? 's' : ''} de volta`}
          </p>
        )}
      </Card>

      {ev ? (
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={ev.name || 'Cliente'} online />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{ev.name || 'Cliente'}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5 text-success" /> via WhatsApp · {hhmm(ev.at)}
                </p>
              </div>
            </div>
            {ev.kind === 'handoff' ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning-foreground">
                <Hand className="h-3.5 w-3.5" /> com você
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-2 text-right">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs leading-tight">
                  <span className="block font-semibold text-foreground">Agente de IA</span>
                  <span className="text-muted-foreground">no controle da conversa</span>
                </span>
              </span>
            )}
          </div>
          <ChatArea>
            {ev.customerText && <Bubble from="cliente" text={ev.customerText} at={ev.at} />}
            <StepChips steps={ev.steps} />
            {ev.kind === 'handoff' ? (
              <p className="text-center text-xs font-medium text-warning-foreground">Passou para você: {ev.reason}</p>
            ) : (
              ev.reply && <Bubble from="ia" text={ev.reply} at={ev.sentAt ?? ev.at} />
            )}
            {ev.kind !== 'handoff' && ev.status !== 'enviada' && (
              <p className="text-center text-[11px] text-muted-foreground">{ev.status === 'pronta' ? 'enviando…' : `não enviada (${ev.status})`}</p>
            )}
          </ChatArea>
          {d.recent.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2">
              {d.recent.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setPick(e.id)}
                  title={e.name}
                  className={`rounded-full p-0.5 ${e.id === ev.id ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'}`}
                >
                  <Avatar name={e.name || '?'} size="sm" />
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-5 text-center text-sm text-muted-foreground">
          Quando a IA responder alguém no WhatsApp, a conversa aparece aqui com cada passo que ela fez.
        </Card>
      )}
    </div>
  );
}
