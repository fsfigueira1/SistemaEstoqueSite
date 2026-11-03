'use client';

// "Chamando de volta": a IA escreve uma mensagem única para cada cliente que
// sumiu e o robô do aplicativo envia sozinho, devagar (src/services/winbackService.ts).
// Liga/desliga aqui; os cartões mostram para quem foi e o que deu.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, LogOut, MessageCircle, Send, ShoppingBag, Clock } from 'lucide-react';
import { Avatar, Bubble, Card, ChatArea, StepChips } from '@/components/atendimento/agentUi';

type CardData = { id: string; name: string; reason: string; text: string; at: string; outcome: string; bought: number };
type Board = { enabled: boolean; days: number; perDay: number; sentToday: number; waiting: number; cards: CardData[] };

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const ago = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
};

const OUTCOME: Record<string, { label: string; icon: typeof Send; cls: string }> = {
  enviada: { label: 'Enviada', icon: Send, cls: 'bg-primary/10 text-primary' },
  respondeu: { label: 'Respondeu', icon: MessageCircle, cls: 'bg-success/15 text-success' },
  comprou: { label: 'Comprou', icon: ShoppingBag, cls: 'bg-success/15 text-success' },
  saiu: { label: 'Pediu para sair', icon: LogOut, cls: 'bg-muted text-muted-foreground' },
  falhou: { label: 'Não foi', icon: AlertTriangle, cls: 'bg-danger/10 text-danger' },
  'na fila': { label: 'Enviando', icon: Clock, cls: 'bg-muted text-muted-foreground' },
};

function WinCard({ c, highlight }: { c: CardData; highlight: boolean }) {
  const o = OUTCOME[c.outcome] ?? OUTCOME.enviada;
  const Icon = o.icon;
  const won = c.outcome === 'comprou';
  return (
    <div className={`rounded-xl border p-3 ${won ? 'border-success/40 bg-success/5' : 'border-border bg-card'} ${highlight ? 'ring-2 ring-primary/60' : ''}`}>
      <div className="flex items-start gap-2.5">
        <Avatar name={c.name || '?'} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{c.name || 'Cliente'}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground" title={c.reason}>
            {c.reason}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${o.cls}`}>
          <Icon className="h-3.5 w-3.5" /> {o.label}
        </span>
        <span className={`font-mono text-[11px] ${won ? 'font-semibold text-success' : 'text-muted-foreground'}`}>{won && c.bought > 0 ? money.format(c.bought) : ago(c.at)}</span>
      </div>
    </div>
  );
}

export default function WinbackBoard() {
  const [b, setB] = useState<Board | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/agent/winback').catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    if (j?.success) setB(j.data);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = async () => {
    if (!b) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waWinbackEnabled: !b.enabled }) });
      if (!r.ok) throw new Error();
      await load();
    } catch {
      setErr('Não consegui mudar agora. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  if (!b) return null;
  const last = b.cards[0];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-foreground">Chamando de volta</h2>
          <p className="text-xs text-muted-foreground">
            Clientes sem comprar há {b.days}+ dias · até {b.perDay} por dia · {b.enabled ? 'ligado' : 'desligado'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${b.enabled ? 'border border-border hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          {b.enabled ? 'Desligar' : 'Ligar'}
        </button>
      </div>
      {err && <p className="px-4 pt-2 text-xs font-medium text-danger">{err}</p>}

      <ChatArea>
        <StepChips steps={[`analisando ${b.waiting} cliente${b.waiting === 1 ? '' : 's'} parado${b.waiting === 1 ? '' : 's'}`, 'lendo o histórico de cada um']} />
        {last ? (
          <Bubble from="ia" text={last.text} at={last.at} />
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {b.enabled
              ? 'A primeira mensagem sai no horário da resposta automática, com o aplicativo do balcão aberto.'
              : 'Ligue para a IA escrever e enviar uma mensagem única para cada cliente que sumiu.'}
          </p>
        )}
      </ChatArea>

      {b.cards.length > 0 && (
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {b.cards.slice(0, 8).map((c, i) => (
            <WinCard key={c.id} c={c} highlight={i === 0} />
          ))}
        </div>
      )}

      <div className="space-y-1.5 px-3 pb-3">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground">
          <Check className="h-4 w-4" strokeWidth={3} /> {b.sentToday} mensage{b.sentToday === 1 ? 'm enviada' : 'ns enviadas'} hoje
        </div>
        <p className="text-center text-xs text-muted-foreground">Uma mensagem única para cada cliente · quem responder SAIR não recebe mais</p>
      </div>
    </Card>
  );
}
