'use client';

// Resposta automática do WhatsApp no Atendimento: liga/desliga, a fila (com o
// tempo que falta para cada resposta e "Cancelar"), o que precisa do atendente
// e as últimas respostas enviadas. Quem responde é o robô do aplicativo
// (electron/whatsappAuto.cjs); a regra fica em src/lib/autoReplyPolicy.ts.

import { useCallback, useEffect, useState } from 'react';
import { Bot, Clock, Hand, Send, X } from 'lucide-react';
import { whatsappBridge, type AutoStatus } from '@/lib/whatsappBridge';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const hhmm = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function AutoReplyPanel() {
  const [st, setSt] = useState<AutoStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await whatsappBridge()?.auto.status().catch(() => null);
    if (s) setSt(s);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = async () => {
    if (!st) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waAutoEnabled: !st.enabled }),
      });
      if (!r.ok) throw new Error();
      const s = await whatsappBridge()?.auto.refresh();
      if (s) setSt(s);
    } catch {
      setErr('Não consegui mudar agora. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  if (!st) return null;
  const situacao = !st.enabled ? 'Desligada' : st.inHours ? 'Ligada — respondendo' : 'Ligada — fora do horário';

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Resposta automática</h2>
            <p className={`text-xs ${st.enabled && st.inHours ? 'text-success' : 'text-muted-foreground'}`}>{situacao}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${st.enabled ? 'border border-border hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          {st.enabled ? 'Desligar' : 'Ligar'}
        </button>
      </div>
      {err && <p className="text-xs font-medium text-danger">{err}</p>}
      {st.enabled && (
        <p className="text-xs text-muted-foreground">
          Responde orçamentos e perguntas simples 4 a 7 minutos depois da mensagem (no máximo {st.maxPerHour} por hora). Se você abrir a
          conversa antes, ela sai da fila.
        </p>
      )}
      {st.lastError && st.enabled && <p className="text-xs text-warning-foreground">Última falha: {st.lastError}</p>}

      {st.queue.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Na fila
          </p>
          {st.queue.map((q) => (
            <div key={q.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
              <span className="truncate">{q.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-muted-foreground">{q.inSec > 0 ? `em ${mmss(q.inSec)}` : 'agora'}</span>
                <button type="button" onClick={() => whatsappBridge()?.auto.cancel(q.name).then(load)} className="text-xs text-danger hover:underline">
                  Cancelar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {st.human.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs font-semibold text-danger">
            <Hand className="h-3.5 w-3.5" /> Precisa de você
          </p>
          {st.human.map((h) => (
            <div key={h.name + h.at} className="flex items-start justify-between gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{h.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {hhmm(h.at)} · {h.reason}
                </span>
              </span>
              <button type="button" aria-label={`Dispensar ${h.name}`} onClick={() => whatsappBridge()?.auto.dismiss(h.name).then(load)} className="rounded p-1 hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {st.sent.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Send className="h-3.5 w-3.5" /> Respondidas
          </p>
          {st.sent.slice(0, 5).map((s) => (
            <p key={s.name + s.at} className="text-xs text-muted-foreground">
              {hhmm(s.at)} · {s.name} · {s.kind}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
