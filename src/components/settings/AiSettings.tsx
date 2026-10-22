'use client';

// Configurações → Inteligência artificial: quem responde no ajudante e lê a
// foto da lista escolar (NVIDIA ou Claude) e a chave da NVIDIA. A chave fica
// no banco da loja (vale nos 3 PCs) e nunca volta para esta tela.

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
}: {
  form: StoreSettings;
  set: <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => void;
  nvidiaKey: string;
  onNvidiaKey: (v: string) => void;
  onRemoveNvidia: () => void;
}) {
  return (
    <Section icon={<Bot className="h-5 w-5" />} title="Inteligência artificial" desc="O ajudante (vendas, estoque, ideias de texto) usa a NVIDIA. Aqui você escolhe quem lê a foto da lista escolar.">
      <div className="space-y-4">
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <ProviderCard
            active={form.aiProvider !== 'claude'}
            onClick={() => set('aiProvider', 'nvidia')}
            title="NVIDIA"
            badge="Recomendado"
            text="A mesma IA do chat do site. Lê a foto da lista."
          />
          <ProviderCard
            active={form.aiProvider === 'claude'}
            onClick={() => set('aiProvider', 'claude')}
            title="Claude"
            text="Lê a foto com a chave do Claude de Pesquisa de preço. O ajudante continua na NVIDIA."
          />
        </div>
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
      </div>
    </Section>
  );
}
