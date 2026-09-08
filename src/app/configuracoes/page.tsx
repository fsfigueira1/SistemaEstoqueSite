'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Settings, Store, Printer, KeyRound, CheckCircle, CreditCard, Users, Database } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  getLocalPin,
  setLocalPin,
  type StoreSettings,
} from '@/lib/settings';

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // PIN
  const [pinCur, setPinCur] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setForm(getSettings());
    setLoaded(true);
  }, []);

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = () => {
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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

  if (!loaded) return <Layout><div className="p-6 text-sm text-gray-500">Carregando…</div></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
            <p className="text-sm text-gray-500">Preferências da loja neste dispositivo</p>
          </div>
        </div>

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

        {/* Impressão */}
        <Section icon={<Printer className="h-5 w-5" />} title="Impressão e comprovante" desc="Comprovante de compra (não fiscal) — Epson TM-T20X">
          <div className="space-y-4">
            <Field label="Largura da bobina">
              <select value={form.receiptWidth} onChange={(e) => set('receiptWidth', e.target.value as StoreSettings['receiptWidth'])} className={inp}>
                <option value="80mm">80 mm</option>
                <option value="58mm">58 mm</option>
              </select>
            </Field>
            <Field label="Rodapé do comprovante">
              <textarea value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} rows={2} className={inp} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.receiptShowCompany} onChange={(e) => set('receiptShowCompany', e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Mostrar dados da empresa no comprovante
            </label>
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <button onClick={save} className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700">
            Salvar configurações
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-700">
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
            <button onClick={changePin} className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50">
              Alterar PIN
            </button>
            {pinMsg && (
              <span className={`text-sm ${pinMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{pinMsg.text}</span>
            )}
          </div>
        </Section>

        {/* Em breve */}
        <Section icon={<CreditCard className="h-5 w-5" />} title="Integração com meios de pagamento" desc="Em breve">
          <p className="text-sm text-gray-500">
            Conciliação automática de cartão/PIX e TEF ainda não estão disponíveis. Hoje a forma de
            pagamento é registrada manualmente no PDV.
          </p>
        </Section>

        <Section icon={<Users className="h-5 w-5" />} title="Usuários e permissões" desc="Desativado">
          <p className="text-sm text-gray-500">
            O sistema opera sem login por usuário — o acesso é protegido apenas pelo PIN do dispositivo.
          </p>
        </Section>

        <Section icon={<Database className="h-5 w-5" />} title="Backup e restauração" desc="Manual">
          <p className="text-sm text-gray-500">
            Os dados ficam no arquivo <code className="rounded bg-gray-100 px-1">dev.db</code> na pasta do
            sistema. Faça backup copiando esse arquivo. Restauração automática pela interface ainda não
            está disponível.
          </p>
        </Section>
      </div>
    </Layout>
  );
}

const inp =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40';

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
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">{icon}</span>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {desc && <p className="text-xs text-gray-500">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
