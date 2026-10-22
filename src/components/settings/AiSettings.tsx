'use client';

// Configurações → Inteligência artificial: quem responde no ajudante e lê a
// foto da lista escolar (NVIDIA ou Claude) e a chave da NVIDIA. A chave fica
// no banco da loja (vale nos 3 PCs) e nunca volta para esta tela.

import { Bot } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';
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
    <Section icon={<Bot className="h-5 w-5" />} title="Inteligência artificial" desc="Ajudante (vendas, estoque, ideias de texto) e leitura da foto da lista escolar">
      <div className="space-y-4">
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <ProviderCard
            active={form.aiProvider !== 'claude'}
            onClick={() => set('aiProvider', 'nvidia')}
            title="NVIDIA"
            badge="Recomendado"
            text="A mesma IA do chat do site. Lê fotos e responde no ajudante."
          />
          <ProviderCard
            active={form.aiProvider === 'claude'}
            onClick={() => set('aiProvider', 'claude')}
            title="Claude"
            text="Usa a chave do Claude cadastrada em Pesquisa de preço."
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
      </div>
    </Section>
  );
}
