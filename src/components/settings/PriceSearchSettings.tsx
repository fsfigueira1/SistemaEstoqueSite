'use client';

// Configurações → "Pesquisa de preço": escolher a fonte (Cosmos grátis ou
// Claude pago), colar o token/chave e ajustar o "toque da loja".

import { useState } from 'react';
import { CheckCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';

const inp =
  'w-full rounded-lg border border-border bg-card px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-60';

export default function PriceSearchSettings({
  form,
  set,
  aiKey,
  onAiKey,
  cosmosKey,
  onCosmosKey,
  onRemoveAi,
  onRemoveCosmos,
}: {
  form: StoreSettings;
  set: <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => void;
  aiKey: string;
  onAiKey: (v: string) => void;
  cosmosKey: string;
  onCosmosKey: (v: string) => void;
  onRemoveAi: () => void;
  onRemoveCosmos: () => void;
}) {
  return (
    <>
      <div id="ia" className="scroll-mt-6" />
      <Section
        icon={<Sparkles className="h-5 w-5" />}
        title="Pesquisa de preço"
        desc="No cadastro, mostra quanto o produto custa no mercado e sugere um preço"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Fonte da pesquisa de preço">
            <ProviderCard
              active={form.priceProvider === 'cosmos'}
              onClick={() => set('priceProvider', 'cosmos')}
              title="Cosmos — grátis"
              badge="Recomendado"
              text="Preço médio no Brasil pelo código de barras (ou por nome). Até 25 consultas por dia."
            />
            <ProviderCard
              active={form.priceProvider === 'claude'}
              onClick={() => set('priceProvider', 'claude')}
              title="Claude — pago"
              text="IA pesquisa papelarias e lojas na web e considera o perfil da loja. Cobrado por uso."
            />
          </div>

          {form.priceProvider === 'cosmos' ? (
            <>
              <SecretBox
                label="Token do Cosmos"
                isSet={Boolean(form.cosmosTokenSet)}
                hint={form.cosmosTokenHint}
                value={cosmosKey}
                onChange={onCosmosKey}
                placeholder="Cole o token da sua conta Cosmos"
                onRemove={onRemoveCosmos}
                help={
                  <>
                    Crie uma conta grátis em cosmos.bluesoft.com.br e copie o token da API na sua conta. O token fica
                    guardado no banco da loja e não aparece de novo nesta tela.
                  </>
                }
              />
              <Field label="Toque da loja: sugerir acima do preço médio em">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.priceMarkupPercent}
                    onChange={(e) => set('priceMarkupPercent', Math.max(0, Number(e.target.value) || 0))}
                    className={inp}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ex.: preço médio R$ 12,00 com 10% → sugestão R$ 13,90 (sempre terminando em ,90). Nunca abaixo do
                  custo + 30%.
                </p>
              </Field>
            </>
          ) : (
            <>
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
              <Field label="Cidade / UF">
                <input
                  value={form.storeCity}
                  onChange={(e) => set('storeCity', e.target.value)}
                  className={inp}
                  placeholder="Ex.: São Paulo/SP"
                />
              </Field>
              <SecretBox
                label="Chave do Claude (Anthropic)"
                isSet={Boolean(form.aiKeySet)}
                hint={form.aiKeyHint}
                value={aiKey}
                onChange={onAiKey}
                placeholder="sk-ant-…"
                onRemove={onRemoveAi}
                help={
                  <>
                    Crie em console.anthropic.com (é cobrada à parte do plano Pro, por uso). A chave fica guardada no
                    banco da loja e não aparece de novo nesta tela.
                  </>
                }
              />
              <Field label="Qualidade da pesquisa">
                <select value={form.aiModel} onChange={(e) => set('aiModel', e.target.value)} className={inp}>
                  <option value="claude-sonnet-5">Equilibrada — Claude Sonnet 5 (recomendado)</option>
                  <option value="claude-haiku-4-5-20251001">Econômica — Claude Haiku 4.5</option>
                  <option value="claude-opus-5-5">Máxima — Claude Opus 5.5</option>
                </select>
              </Field>
            </>
          )}

          <Field label="Avisar quando o mercado passar do meu preço em">
            <div className="flex items-center gap-2 sm:w-1/2">
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
      </Section>
    </>
  );
}

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

function ProviderCard({
  active,
  onClick,
  title,
  text,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active ? 'border-primary bg-accent-soft/60 ring-1 ring-primary/40' : 'border-border hover:border-primary/40'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{title}</span>
        {badge && <span className="pill pill-ok">{badge}</span>}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{text}</span>
    </button>
  );
}

function SecretBox({
  label,
  isSet,
  hint,
  value,
  onChange,
  placeholder,
  onRemove,
  help,
}: {
  label: string;
  isSet: boolean;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onRemove: () => void;
  help: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {isSet ? (
          <span className="pill pill-ok">
            <CheckCircle className="h-3 w-3" /> Configurado {hint}
          </span>
        ) : (
          <span className="pill pill-muted">Não configurado</span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isSet ? 'Cole outro para trocar' : placeholder}
            autoComplete="off"
            className={`${inp} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label={show ? 'Esconder' : 'Mostrar'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {isSet && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-border px-3 text-sm text-danger hover:bg-danger/10"
          >
            Remover
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
