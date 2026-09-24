'use client';

// Assistente do relatório do dia.
// No horário de fechamento (Configurações → Assistente), a mascote aparece no
// canto da tela com o resumo do dia e um atalho para a página do relatório.
// Também abre sob demanda pelo botão "Resumo do dia" no menu lateral.
//
// "Lembrar depois" e "dispensar hoje" ficam guardados neste computador
// (localStorage) — é uma preferência de tela, não um dado da loja.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, ArrowRight, Clock, Banknote, CreditCard, QrCode, Loader2 } from 'lucide-react';
import type { DailyReport } from '@/services/reportService';
import { loadSettings } from '@/lib/settings';
import { errorText } from '@/lib/friendlyError';

const OPEN_EVENT = 'lacolaria:assistant-open';

/** Abre o balão da assistente de qualquer lugar do app. */
export function openDailyAssistant() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const store = {
  get(k: string) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignora */
    }
  },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DailyAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false); // aberto pelo horário (x pelo botão)
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cfg = useRef<{ enabled: boolean; time: string }>({ enabled: true, time: '18:00' });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/daily?date=${todayKey()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(errorText(data, 'Relatório indisponível'));
      setReport(data.data);
      return data.data as DailyReport;
    } catch (e) {
      setErr(errorText(e, 'Relatório indisponível'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // aberto pelo botão do menu
  useEffect(() => {
    const onOpen = () => {
      setAuto(false);
      setOpen(true);
      fetchReport();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [fetchReport]);

  // aviso automático no horário de fechamento
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => {
      cfg.current = {
        enabled: s.reportReminderEnabled !== false,
        time: /^\d{2}:\d{2}$/.test(s.reportReminderTime ?? '') ? s.reportReminderTime : '18:00',
      };
    });

    const check = async () => {
      if (!alive || !cfg.current.enabled) return;
      const key = todayKey();
      if (store.get('assistant_dismissed') === key) return;
      const snooze = Number(store.get('assistant_snooze_until') || 0);
      if (snooze && Date.now() < snooze) return;
      const [hh, mm] = cfg.current.time.split(':').map(Number);
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;

      const r = await fetchReport();
      if (!alive || !r) return;
      // já conferiu o caixa ou não vendeu nada? não incomoda.
      if (r.closing || r.salesCount === 0) {
        store.set('assistant_dismissed', key);
        return;
      }
      setAuto(true);
      setOpen(true);
    };

    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [fetchReport]);

  const snooze = () => {
    store.set('assistant_snooze_until', String(Date.now() + 30 * 60_000));
    setOpen(false);
  };
  const dismiss = () => {
    if (auto) store.set('assistant_dismissed', todayKey());
    setOpen(false);
  };

  if (!open) return null;

  // No PDV o balão fica compacto no topo para não cobrir o botão de finalizar.
  const compact = pathname?.startsWith('/pdv');
  const href = `/relatorios/${todayKey()}`;

  return (
    <div
      role="dialog"
      aria-label="Assistente do relatório do dia"
      className={`fixed z-50 w-[min(24rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-2 ${
        compact ? 'right-4 top-4' : 'bottom-5 right-5'
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-start gap-3 border-b border-border bg-bow-soft/60 px-4 py-3">
          <img src="/logo.png" alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover ring-1 ring-black/5" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow !text-bow">Assistente</p>
            <p className="font-heading text-lg font-semibold leading-snug text-foreground">
              {auto ? 'Hora de fechar o dia' : `${greeting()}! Aqui está o dia`}
            </p>
          </div>
          <button onClick={dismiss} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {loading && !report ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Somando as vendas…
            </p>
          ) : err ? (
            <p className="text-sm font-medium text-danger">{err}</p>
          ) : report ? (
            <>
              <p className="text-sm text-foreground">
                {report.salesCount === 0 ? (
                  'Ainda não houve vendas hoje.'
                ) : (
                  <>
                    Hoje entraram <strong className="tabular-nums">{brl(report.netTotal)}</strong> em{' '}
                    {report.salesCount} {report.salesCount === 1 ? 'venda' : 'vendas'}.
                  </>
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Mini icon={<Banknote className="h-3.5 w-3.5" />} label="Dinheiro" value={report.net.cash} />
                <Mini icon={<CreditCard className="h-3.5 w-3.5" />} label="Cartão" value={report.net.card} />
                <Mini icon={<QrCode className="h-3.5 w-3.5" />} label="Pix" value={report.net.pix} />
              </div>
              {report.insights[1] && <p className="text-xs text-muted-foreground">{report.insights[1]}</p>}
              {report.closing ? (
                <p className="pill pill-ok">Caixa conferido</p>
              ) : report.salesCount > 0 ? (
                <p className="text-xs text-muted-foreground">Conte a gaveta, a maquininha e o Pix e confira se bate.</p>
              ) : null}
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href={href}
              onClick={() => {
                if (auto) store.set('assistant_dismissed', todayKey());
                setOpen(false);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {report?.closing ? 'Ver relatório' : 'Conferir o caixa'} <ArrowRight className="h-4 w-4" />
            </Link>
            {auto && (
              <button
                onClick={snooze}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90 hover:bg-muted"
              >
                <Clock className="h-4 w-4" /> 30 min
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{brl(value)}</div>
    </div>
  );
}
