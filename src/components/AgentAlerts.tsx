'use client';

// Avisos da assistente (Nemotron) no canto da tela: conversa que precisa de
// atendente e cliente que parou de responder. Atualiza a cada 30 s.
// "Fechar" esconde o quadro até chegar um aviso novo (guardado neste
// computador); "Visto" tira o aviso para todo mundo; "Sugerir mensagem" pede
// ao Nemotron um texto para retomar (a pessoa confere e envia no WhatsApp).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KodaMark } from '@/components/KodaLogo';
import { Check, ChevronDown, Copy, Hand, Loader2, MessageCircleOff, Sparkles, X } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';

type Alert = { id: string; type: 'atendente' | 'parou'; name: string; reason: string; customerText: string; at: string };

const KEY = 'agent_alerts_closed_at';
const store = {
  get: () => {
    try {
      return Number(window.localStorage.getItem(KEY) || 0);
    } catch {
      return 0;
    }
  },
  set: (v: number) => {
    try {
      window.localStorage.setItem(KEY, String(v));
    } catch {
      /* sem localStorage: só não lembra que fechou */
    }
  },
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
};

function Item({ a, onSeen }: { a: Alert; onSeen: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const Icon = a.type === 'atendente' ? Hand : MessageCircleOff;

  const suggest = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/agent/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, action: 'suggest' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(errorText(d, 'A IA não respondeu agora'));
      setText(d.data.text);
    } catch (e) {
      setErr(errorText(e, 'A IA não respondeu agora'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.type === 'atendente' ? 'bg-danger/10 text-danger' : 'bg-warning/15 text-warning-foreground'}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{a.name}</span> <span className="text-muted-foreground">· {ago(a.at)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{a.type === 'atendente' ? `Precisa de você: ${a.reason}` : a.reason}</p>
          {a.customerText && <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">“{a.customerText}”</p>}
        </div>
      </div>
      {text && (
        <div className="rounded-lg bg-muted/60 p-2.5 text-sm text-foreground">
          <p className="whitespace-pre-wrap">{text}</p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copiada' : 'Copiar'}
          </button>
        </div>
      )}
      {err && <p className="text-xs font-medium text-danger">{err}</p>}
      <div className="flex flex-wrap gap-1.5 pl-9">
        <Link href="/atendimento" className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          Abrir atendimento
        </Link>
        {a.type === 'parou' && !text && (
          <button type="button" onClick={suggest} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Sugerir mensagem
          </button>
        )}
        <button type="button" onClick={() => onSeen(a.id)} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
          Visto
        </button>
      </div>
    </li>
  );
}

export default function AgentAlerts() {
  const pathname = usePathname();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [closedAt, setClosedAt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/agent/alerts').catch(() => null);
    const d = r && r.ok ? await r.json().catch(() => null) : null;
    if (d?.success) setAlerts(d.data);
  }, []);

  useEffect(() => {
    setClosedAt(store.get());
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const seen = async (id: string) => {
    setAlerts((list) => list.filter((a) => a.id !== id));
    await fetch('/api/agent/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'seen' }) }).catch(() => {});
  };

  const close = () => {
    const now = Date.now();
    store.set(now);
    setClosedAt(now);
    setExpanded(false);
  };

  // fechado: só volta quando chegar aviso mais novo que o fechamento
  const fresh = alerts.filter((a) => new Date(a.at).getTime() > closedAt);
  if (!alerts.length || !fresh.length) return null;
  const urgent = alerts.filter((a) => a.type === 'atendente').length;
  const title = urgent ? `${urgent} conversa${urgent > 1 ? 's precisam' : ' precisa'} de você` : `${alerts.length} cliente${alerts.length > 1 ? 's pararam' : ' parou'} de responder`;
  // na tela do PDV fica no alto, longe do botão de finalizar
  const pos = pathname?.startsWith('/pdv') ? 'top-32' : 'bottom-5';

  return (
    <aside aria-label="Avisos da assistente" className={`fixed left-4 z-50 w-[min(23rem,calc(100vw-2rem))] lg:left-8 ${pos}`}>
      <div className={`overflow-hidden border border-border bg-card shadow-xl ${expanded ? 'rounded-3xl' : 'rounded-[2rem]'}`}>
        <div className="flex items-center gap-3 py-2.5 pl-2.5 pr-4">
          <span className="relative shrink-0">
            <KodaMark className="h-11 w-11 text-xl" />
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 font-mono text-[10px] font-bold text-cream ring-2 ring-card">{alerts.length}</span>
          </span>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
            <span className="block text-[11px] font-medium text-muted-foreground">Assistente de IA</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
              {title}
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </span>
          </button>
          <button type="button" onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar avisos">
            <X className="h-4 w-4" />
          </button>
        </div>
        {expanded && (
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto border-t border-border">
            {alerts.map((a) => (
              <Item key={a.id} a={a} onSeen={seen} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
