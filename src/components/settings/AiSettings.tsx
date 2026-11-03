'use client';

// Configurações → Inteligência artificial: qual IA responde (NVIDIA ou Gemini,
// uma de reserva da outra — src/lib/llm.ts), quem lê a foto da lista (pode
// ser o Claude) e as chaves. As chaves ficam no banco da loja (valem nos 3
// PCs) e nunca voltam para esta tela.

import { Bot } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';
import { DEFAULT_PERSONA } from '@/lib/copilotStyle';
import { ProviderCard, Section, SecretBox } from './PriceSearchSettings';

export default function AiSettings({
  form,
  set,
  nvidiaKey,
  onNvidiaKey,
  onRemoveNvidia,
  geminiKey,
  onGeminiKey,
  onRemoveGemini,
}: {
  form: StoreSettings;
  set: <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => void;
  nvidiaKey: string;
  onNvidiaKey: (v: string) => void;
  onRemoveNvidia: () => void;
  geminiKey: string;
  onGeminiKey: (v: string) => void;
  onRemoveGemini: () => void;
}) {
  const both = Boolean(form.nvidiaKeySet && form.geminiKeySet);
  return (
    <Section icon={<Bot className="h-5 w-5" />} title="Inteligência artificial" desc="Quem responde no WhatsApp, no ajudante e nos avisos. Com as duas chaves, se uma acabar o limite ou sair do ar, a outra assume sozinha.">
      <div className="space-y-4">
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
          <ProviderCard
            active={form.aiProvider === 'nvidia'}
            onClick={() => set('aiProvider', 'nvidia')}
            title="NVIDIA"
            badge="Recomendado"
            text="Nemotron, a mesma IA do chat do site. Gratuita, às vezes lenta."
          />
          <ProviderCard
            active={form.aiProvider === 'gemini'}
            onClick={() => set('aiProvider', 'gemini')}
            title="Gemini"
            text="IA do Google. Rápida; a chave grátis tem limite por dia."
          />
          <ProviderCard
            active={form.aiProvider === 'claude'}
            onClick={() => set('aiProvider', 'claude')}
            title="Claude"
            text="Só lê a foto da lista (chave da Pesquisa de preço). O resto fica com NVIDIA ou Gemini."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {both
            ? `Principal: ${form.aiProvider === 'gemini' ? 'Gemini' : 'NVIDIA'}. Reserva: ${form.aiProvider === 'gemini' ? 'NVIDIA' : 'Gemini'}.`
            : 'Cadastre as duas chaves para uma cobrir a outra quando falhar.'}
        </p>
        <SecretBox
          label="Chave da NVIDIA"
          isSet={Boolean(form.nvidiaKeySet)}
          hint={form.nvidiaKeyHint}
          value={nvidiaKey}
          onChange={onNvidiaKey}
          placeholder="nvapi-…"
          onRemove={onRemoveNvidia}
          help={
            <>
              Crie em build.nvidia.com (Get API Key). A chave fica guardada no banco da loja, vale para todos os computadores e não
              aparece de novo nesta tela.
            </>
          }
        />
        <SecretBox
          label="Chave do Gemini"
          isSet={Boolean(form.geminiKeySet)}
          hint={form.geminiKeyHint}
          value={geminiKey}
          onChange={onGeminiKey}
          placeholder="AIza…"
          onRemove={onRemoveGemini}
          help={
            <>
              Crie em aistudio.google.com (Get API key). Fica guardada no banco da loja, vale para todos os computadores e não aparece de novo
              nesta tela.
            </>
          }
        />
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Modelo do Gemini</span>
          <input
            value={form.geminiModel}
            onChange={(e) => set('geminiModel', e.target.value)}
            placeholder="gemini-3.8-flash"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm sm:max-w-xs"
          />
        </label>
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Tom de voz do atendimento (WhatsApp)</p>
            {form.copilotPersona.trim() && (
              <button type="button" onClick={() => set('copilotPersona', '')} className="text-xs text-primary hover:underline">
                Voltar ao padrão
              </button>
            )}
          </div>
          <textarea
            value={form.copilotPersona}
            onChange={(e) => set('copilotPersona', e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder={DEFAULT_PERSONA}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Vazio = o jeito padrão (super carismática). A IA também aprende com as respostas que você aprova no Atendimento. Preço nunca vem da IA.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={form.waAutoEnabled} onChange={(e) => set('waAutoEnabled', e.target.checked)} className="h-4 w-4" />
            Resposta automática do WhatsApp
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Só no aplicativo do balcão, com o WhatsApp conectado no Atendimento. O agente (NVIDIA ou Gemini) responde sozinho 4 a 7 minutos depois da
            mensagem: busca no estoque, monta orçamento e tira dúvidas; troca, defeito, reclamação e cobrança ficam em &quot;Precisa de
            você&quot;. O WhatsApp não permite robôs: mesmo com o atraso, existe risco de bloqueio do número.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {(
              [
                ['waAutoWeekdays', 'Seg a sex'],
                ['waAutoSaturday', 'Sábado'],
                ['waAutoSunday', 'Domingo'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <input
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                  placeholder="fechado"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
            ))}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Máximo por hora</span>
              <input
                type="number"
                min={1}
                max={60}
                value={form.waAutoMaxPerHour}
                onChange={(e) => set('waAutoMaxPerHour', Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Horário no formato 08:00-18:00. Vazio = não responde nesse dia.</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={form.waWinbackEnabled} onChange={(e) => set('waWinbackEnabled', e.target.checked)} className="h-4 w-4" />
            Chamar de volta clientes parados
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Quem comprou ou pediu orçamento e sumiu recebe uma mensagem única escrita pela IA, enviada sozinha pelo robô no horário acima, com
            12 a 25 minutos entre uma e outra. Cada pessoa no máximo 1 vez a cada 90 dias; quem responder SAIR não recebe mais. Mensagem que a
            pessoa não pediu é o que mais leva o WhatsApp a bloquear o número — comece com poucas por dia.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Parado há (dias)</span>
              <input
                type="number"
                min={15}
                max={365}
                value={form.waWinbackDays}
                onChange={(e) => set('waWinbackDays', Number(e.target.value) || 60)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Máximo por dia</span>
              <input
                type="number"
                min={1}
                max={20}
                value={form.waWinbackPerDay}
                onChange={(e) => set('waWinbackPerDay', Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
      </div>
    </Section>
  );
}
