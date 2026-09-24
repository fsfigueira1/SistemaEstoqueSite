'use client';

import { useEffect, useState } from 'react';
import Layout, { PageHeader } from '@/components/Layout';
import { Store, Printer, KeyRound, CheckCircle, CreditCard, Users, Database, Sparkles, BellRing, Eye, EyeOff } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  getLocalPin,
  setLocalPin,
  type StoreSettings,
} from '@/lib/settings';

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // chave da IA: nunca vem do servidor; o campo só serve para trocar
  const [aiKey, setAiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // PIN
  const [pinCur, setPinCur] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadSettings().then((s) => {
      setForm(s);
      setLoaded(true);
    });
  }, []);

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    const next = await saveSettings(form, aiKey.trim() ? { aiApiKey: aiKey.trim() } : undefined);
    setForm(next);
    setAiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const removeKey = async () => {
    if (!window.confirm('Remover a chave da IA? A sugestão de preço para de funcionar até colar outra.')) return;
    const next = await saveSettings(form, { aiApiKeyClear: true });
    setForm(next);
  };

  const changePin = () => {
    setPinMsg(null);
    const current = getLocalPin() ?? '1234';
    if (pinCur !== current) {
      setPinMsg({ ok: false, text: 'PIN atual incorreto.' });
      return;
    }
    if (pinNew.trim().length < 4) {
      setPinMsg({ ok: false, text: 'O novo PIN precisa ter ao menos 4 dígitos.' });
      return;
    }
    setLocalPin(pinNew.trim());
    setPinCur('');
    setPinNew('');
    setPinMsg({ ok: true, text: 'PIN atualizado neste dispositivo.' });
  };

  if (!loaded) return <Layout><div className="p-6 text-sm text-muted-foreground">Carregando…</div></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <PageHeader eyebrow="Gestão" title="Configurações" subtitle="Valem para todos os computadores da loja (exceto o PIN)" />

        {/* Dados da empresa */}
        <Section icon={<Store className="h-5 w-5" />} title="Dados da empresa" desc="Aparecem no comprovante de compra">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome / razão social">
              <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className={inp} />
            </Field>
            <Field label="Descrição curta">
              <input value={form.companyTagline} onChange={(e) => set('companyTagline', e.target.value)} className={inp} />
            </Field>
            <Field label="CNPJ / CPF">
              <input value={form.companyDoc} onChange={(e) => set('companyDoc', e.target.value)} className={inp} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Telefone">
              <input value={form.companyPhone} onChange={(e) => set('companyPhone', e.target.value)} className={inp} placeholder="(00) 00000-0000" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço">
                <input value={form.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} className={inp} placeholder="Rua, número — bairro, cidade/UF" />
              </Field>
            </div>
          </div>
        </Section>

        {/* IA de preços */}
        <div id="ia" className="scroll-mt-6" />
        <Section
          icon={<Sparkles className="h-5 w-5" />}
          title="Perfil da loja e IA de preços"
          desc="A IA pesquisa o mercado e sugere preços pensando neste perfil"
        >
          <div className="space-y-4">
            <Field label="Como é a sua loja">
              <textarea
                value={form.storeProfile}
                onChange={(e) => set('storeProfile', e.target.value)}
                rows={3}
                className={inp}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Posicionamento, público, bairro. Ex.: &quot;papelaria nova, bem localizada, toque gourmet&quot;.
              </p>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cidade / UF">
                <input
                  value={form.storeCity}
                  onChange={(e) => set('storeCity', e.target.value)}
                  className={inp}
                  placeholder="Ex.: São Paulo/SP"
                />
              </Field>
              <Field label="Avisar quando o mercado passar do meu preço em">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.priceAlertPercent}
                    onChange={(e) => set('priceAlertPercent', Number(e.target.value) || 10)}
                    className={inp}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </Field>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Chave do Claude (Anthropic)</p>
                {form.aiKeySet ? (
                  <span className="pill pill-ok">
                    <CheckCircle className="h-3 w-3" /> Configurada {form.aiKeyHint}
                  </span>
                ) : (
                  <span className="pill pill-muted">Não configurada</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={aiKey}
                    onChange={(e) => {
                      setAiKey(e.target.value);
                      setSaved(false);
                    }}
                    placeholder={form.aiKeySet ? 'Cole outra chave para trocar' : 'sk-ant-…'}
                    autoComplete="off"
                    className={`${inp} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showKey ? 'Esconder chave' : 'Mostrar chave'}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.aiKeySet && (
                  <button type="button" onClick={removeKey} className="rounded-lg border border-border px-3 text-sm text-danger hover:bg-danger/10">
                    Remover
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Crie em console.anthropic.com (é cobrada à parte do plano Pro, por uso). A chave fica guardada no banco da loja
                e não aparece de novo nesta tela.
              </p>
              <div className="mt-3">
                <Field label="Qualidade da pesquisa">
                  <select value={form.aiModel} onChange={(e) => set('aiModel', e.target.value)} className={inp}>
                    <option value="claude-sonnet-5">Equilibrada — Claude Sonnet 5 (recomendado)</option>
                    <option value="claude-haiku-4-5-20251001">Econômica — Claude Haiku 4.5</option>
                    <option value="claude-opus-5-5">Máxima — Claude Opus 5.5</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </Section>

        {/* Assistente do relatório do dia */}
        <Section
          icon={<BellRing className="h-5 w-5" />}
          title="Assistente do relatório do dia"
          desc="Avisa no horário de fechamento com o resumo e o atalho para conferir o caixa"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-foreground/90 sm:col-span-3">
              <input
                type="checkbox"
                checked={form.reportReminderEnabled}
                onChange={(e) => set('reportReminderEnabled', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Avisar todo dia
            </label>
            <Field label="Horário do aviso">
              <input
                type="time"
                value={form.reportReminderTime}
                onChange={(e) => set('reportReminderTime', e.target.value)}
                disabled={!form.reportReminderEnabled}
                className={inp}
              />
            </Field>
            <Field label="Fundo de troco padrão (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cashFloatDefault}
                onChange={(e) => set('cashFloatDefault', Number(e.target.value) || 0)}
                className={inp}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            O fundo de troco é o dinheiro que já fica na gaveta ao abrir. Ele entra na conta do &quot;dinheiro esperado&quot; na
            conferência.
          </p>
        </Section>

        {/* Impressão */}
        <Section icon={<Printer className="h-5 w-5" />} title="Impressão e comprovante" desc="Comprovante de compra (não fiscal) — Epson TM-T20X">
          <div className="space-y-4">
            <Field label="Largura da bobina">
              <select value={form.receiptWidth} onChange={(e) => set('receiptWidth', e.target.value as StoreSettings['receiptWidth'])} className={inp}>
                <option value="80mm">80 mm</option>
                <option value="58mm">58 mm</option>
              </select>
            </Field>
            <ReceiptWidthPreview width={form.receiptWidth} storeName={form.companyName} />
            <Field label="Rodapé do comprovante">
              <textarea value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} rows={2} className={inp} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground/90">
              <input type="checkbox" checked={form.receiptShowCompany} onChange={(e) => set('receiptShowCompany', e.target.checked)} className="h-4 w-4 rounded border-border" />
              Mostrar dados da empresa no comprovante
            </label>
          </div>
        </Section>

        {/* PDV / pagamento */}
        <Section
          icon={<CreditCard className="h-5 w-5" />}
          title="Cartão parcelado"
          desc="Juros aplicado no PDV às vendas no cartão de crédito"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Juros (% sobre o subtotal)">
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.cardInterestPercent}
                onChange={(e) => set('cardInterestPercent', Number(e.target.value) || 0)}
                className={inp}
              />
            </Field>
            <Field label="Aplicar a partir de">
              <select
                value={form.cardInterestFromInstallments}
                onChange={(e) => set('cardInterestFromInstallments', Number(e.target.value) || 2)}
                className={inp}
              >
                <option value={2}>2 parcelas</option>
                <option value={3}>3 parcelas</option>
                <option value={4}>4 parcelas</option>
                <option value={6}>6 parcelas</option>
              </select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Deixe o juros em 0 para não cobrar acréscimo no parcelado.
          </p>
        </Section>

        <div className="flex items-center gap-3">
          <button onClick={save} className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90">
            Salvar configurações
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <CheckCircle className="h-4 w-4" /> Salvo
            </span>
          )}
        </div>

        {/* PIN */}
        <Section icon={<KeyRound className="h-5 w-5" />} title="PIN de acesso" desc="Bloqueio de tela deste dispositivo">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="PIN atual">
              <input type="password" value={pinCur} onChange={(e) => setPinCur(e.target.value)} className={inp} maxLength={6} />
            </Field>
            <Field label="Novo PIN">
              <input type="password" value={pinNew} onChange={(e) => setPinNew(e.target.value)} className={inp} maxLength={6} />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={changePin} className="rounded-lg border border-border px-4 py-2 font-medium text-foreground/90 hover:bg-muted">
              Alterar PIN
            </button>
            {pinMsg && (
              <span className={`text-sm ${pinMsg.ok ? 'text-primary' : 'text-danger'}`}>{pinMsg.text}</span>
            )}
          </div>
        </Section>

        {/* Em breve */}
        <Section icon={<CreditCard className="h-5 w-5" />} title="Integração com meios de pagamento" desc="Em breve">
          <p className="text-sm text-muted-foreground">
            Conciliação automática de cartão/PIX e TEF ainda não estão disponíveis. Hoje a forma de
            pagamento é registrada manualmente no PDV.
          </p>
        </Section>

        <Section icon={<Users className="h-5 w-5" />} title="Usuários e permissões" desc="Desativado">
          <p className="text-sm text-muted-foreground">
            O sistema opera sem login por usuário — o acesso é protegido apenas pelo PIN do dispositivo.
          </p>
        </Section>

        <Section icon={<Database className="h-5 w-5" />} title="Backup e restauração" desc="Manual">
          <p className="text-sm text-muted-foreground">
            Os dados ficam no banco da loja no Supabase, compartilhado pelos computadores. O Supabase faz cópias
            automáticas; restauração pela interface ainda não está disponível.
          </p>
        </Section>
      </div>
    </Layout>
  );
}

const inp =
  'w-full rounded-lg border border-border bg-card px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-60';

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-lg bg-accent-soft p-2 text-primary">{icon}</span>
        <div>
          <h2 className="text-lg text-foreground">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground/90">{label}</label>
      {children}
    </div>
  );
}

// Espelha as margens cegas reais usadas na impressão (ver @media print em
// globals.css / ReceiptPrint.tsx): 80mm tem folga assimétrica pela zona não
// imprimível da Epson TM-T20X; 58mm usa recuo simétrico.
function ReceiptWidthPreview({
  width,
  storeName,
}: {
  width: StoreSettings['receiptWidth'];
  storeName: string;
}) {
  const isNarrow = width === '58mm';
  const padRight = isNarrow ? '5mm' : '2mm';
  const printable = isNarrow ? '48mm' : '73mm';

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
      <p className="mb-3 text-center text-xs text-muted-foreground">
        Pré-visualização — bobina de {width === '58mm' ? '58 mm' : '80 mm'} (área imprimível ≈ {printable}, sempre
        centralizada)
      </p>
      <div
        className="mx-auto rounded-sm border border-border bg-white shadow-sm transition-[width] duration-200"
        style={{ width, boxSizing: 'border-box', padding: `3mm ${padRight} 3mm 5mm` }}
      >
        <div className="text-center text-[11px] font-bold text-black">{storeName || 'LAÇOLARIA'}</div>
        <div className="my-1.5 border-t border-dashed border-black/40" />
        <div className="flex justify-between gap-2 text-[9px] text-black">
          <span>2 x R$ 11,50</span>
          <span>R$ 23,00</span>
        </div>
        <div className="my-1.5 border-t border-dashed border-black/40" />
        <div className="flex justify-between gap-2 text-[11px] font-bold text-black">
          <span>TOTAL</span>
          <span>R$ 23,00</span>
        </div>
      </div>
    </div>
  );
}
