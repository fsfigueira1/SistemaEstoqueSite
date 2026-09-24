'use client';

// Relatório do dia — página própria de cada data (/relatorios/AAAA-MM-DD).
// Mostra o que entrou por forma de pagamento (dinheiro, cartão, Pix) e deixa
// a pessoa contar a gaveta, a maquininha e o Pix para ver se bate.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Banknote,
  CreditCard,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Save,
  ClipboardCheck,
} from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import type { DailyReport } from '@/services/reportService';
import { computeDifference, computeExpected, parseMoney } from '@/lib/closing';
import { errorText } from '@/lib/friendlyError';
import {
  AssistantSummary,
  CountTable,
  DaySidebar,
  MethodCard,
  MoneyField,
  ResultBanner,
  brl,
} from '@/components/reports/DayReportParts';

const moneyInput = (v: number | null | undefined) =>
  v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function keyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseKey(k: string) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shiftKey(k: string, days: number) {
  const d = parseKey(k);
  d.setDate(d.getDate() + days);
  return keyOf(d);
}
function longDate(k: string) {
  const s = parseKey(k).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Form = {
  cashFloat: string;
  withdrawals: string;
  countedCash: string;
  countedCard: string;
  countedPix: string;
  notes: string;
};

export default function RelatorioDiaPage() {
  const params = useParams<{ data: string }>();
  const router = useRouter();
  const today = keyOf(new Date());
  const key = /^\d{4}-\d{2}-\d{2}$/.test(params?.data ?? '') ? params.data : today;

  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    cashFloat: '',
    withdrawals: '',
    countedCash: '',
    countedCard: '',
    countedPix: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/daily?date=${key}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(errorText(data, 'Relatório indisponível'));
      const r: DailyReport = data.data;
      setReport(r);
      const c = r.closing;
      setForm({
        cashFloat: moneyInput(c ? c.cashFloat : r.cashFloatDefault),
        withdrawals: c && c.withdrawals ? moneyInput(c.withdrawals) : '',
        countedCash: moneyInput(c?.countedCash),
        countedCard: moneyInput(c?.countedCard),
        countedPix: moneyInput(c?.countedPix),
        notes: c?.notes ?? '',
      });
    } catch (e) {
      setErr(errorText(e, 'Relatório indisponível'));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaveMsg(null);
  };

  // conta ao vivo enquanto digita
  const calc = useMemo(() => {
    if (!report) return null;
    const cashFloat = parseMoney(form.cashFloat) ?? 0;
    const withdrawals = parseMoney(form.withdrawals) ?? 0;
    const expected = computeExpected(report, cashFloat, withdrawals);
    const counted = {
      countedCash: parseMoney(form.countedCash),
      countedCard: parseMoney(form.countedCard),
      countedPix: parseMoney(form.countedPix),
    };
    const anyCounted = counted.countedCash != null || counted.countedCard != null || counted.countedPix != null;
    const diff = computeDifference(expected, counted);
    return { expected, counted, anyCounted, diff, cashFloat, withdrawals };
  }, [report, form]);

  const save = async () => {
    if (!calc) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/reports/daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: key,
          cashFloat: calc.cashFloat,
          withdrawals: calc.withdrawals,
          ...calc.counted,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(errorText(data, 'Não foi possível salvar'));
      setReport((r) => (r ? { ...r, closing: data.data } : r));
      setSaveMsg({ ok: true, text: 'Conferência salva' });
    } catch (e) {
      setSaveMsg({ ok: false, text: errorText(e, 'Não foi possível salvar') });
    } finally {
      setSaving(false);
    }
  };

  const go = (k: string) => router.push(`/relatorios/${k}`);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow={key === today ? 'Relatório de hoje' : 'Relatório do dia'}
          title={longDate(key)}
          actions={
            <>
              <button
                onClick={() => go(shiftKey(key, -1))}
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dia anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={key}
                max={today}
                onChange={(e) => e.target.value && go(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                aria-label="Escolher data"
              />
              <button
                onClick={() => go(shiftKey(key, 1))}
                disabled={key >= today}
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Próximo dia"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {key !== today && (
                <button
                  onClick={() => go(today)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Hoje
                </button>
              )}
              <Link href="/relatorios" className="px-2 text-sm text-primary hover:underline">
                Todos os dias
              </Link>
            </>
          }
        />

        {loading && !report ? (
          <div className="py-24 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Somando o dia…
          </div>
        ) : err ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
            {err}
          </div>
        ) : report && calc ? (
          <>
            <AssistantSummary report={report} />

            {/* o que entrou */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl text-foreground">O que entrou</h2>
                <p className="text-sm text-muted-foreground">
                  Total{' '}
                  <strong className="font-heading text-lg text-foreground tabular-nums">{brl(report.netTotal)}</strong>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MethodCard
                  icon={<Banknote className="h-5 w-5" />}
                  label="Dinheiro"
                  value={report.net.cash}
                  refunded={report.refunded.cash}
                />
                <MethodCard
                  icon={<CreditCard className="h-5 w-5" />}
                  label="Cartão"
                  value={report.net.card}
                  refunded={report.refunded.card}
                  detail={`Crédito ${brl(report.card.credit)} · Débito ${brl(report.card.debit)}`}
                />
                <MethodCard
                  icon={<QrCode className="h-5 w-5" />}
                  label="Pix"
                  value={report.net.pix}
                  refunded={report.refunded.pix}
                />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* conferência */}
              <section className="rounded-2xl border border-border bg-card shadow-sm lg:col-span-3">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    <h2 className="text-xl text-foreground">Conferência do caixa</h2>
                  </div>
                  {report.closing && (
                    <span className="pill pill-ok">
                      <CheckCircle2 className="h-3 w-3" />
                      Conferido às{' '}
                      {new Date(report.closing.updatedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                <div className="space-y-5 p-5">
                  <p className="text-sm text-muted-foreground">
                    Conte o dinheiro da gaveta, veja o total da maquininha e o extrato do Pix. Digite os valores: a
                    diferença aparece na hora.
                  </p>

                  {/* dinheiro: fundo e retiradas */}
                  <div className="grid gap-3 rounded-xl bg-muted/60 p-4 sm:grid-cols-2">
                    <MoneyField
                      label="Fundo de troco"
                      hint="Dinheiro que já estava na gaveta ao abrir"
                      value={form.cashFloat}
                      onChange={(v) => set('cashFloat', v)}
                    />
                    <MoneyField
                      label="Retiradas do dia"
                      hint="Sangria, pagamento de fornecedor…"
                      value={form.withdrawals}
                      onChange={(v) => set('withdrawals', v)}
                    />
                  </div>

                  <CountTable report={report} calc={calc} form={form} onChange={(k, v) => set(k, v)} />

                  {calc.anyCounted && <ResultBanner diff={calc.diff} />}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground/90">Observação</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      rows={2}
                      placeholder="Ex.: faltou troco de R$ 2,00 — cliente pagou depois"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={save}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {report.closing ? 'Atualizar conferência' : 'Salvar conferência'}
                    </button>
                    {saveMsg && (
                      <span className={`text-sm font-medium ${saveMsg.ok ? 'text-success' : 'text-danger'}`}>
                        {saveMsg.text}
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <DaySidebar report={report} />
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
