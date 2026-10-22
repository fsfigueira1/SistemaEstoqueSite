'use client';

// Novidades: contatos (planilha, clientes, WhatsApp) e envio da novidade pelo
// WhatsApp Business do celular. Sem a API da Meta por enquanto — quando ela
// voltar, esta tela ganha o envio automático.

import { useCallback, useEffect, useState } from 'react';
import Layout, { PageHeader } from '@/components/Layout';
import ContactsTab from '@/components/novidades/ContactsTab';
import SendTab from '@/components/novidades/SendTab';
import { USE_EVENT, openAssistantChat } from '@/components/AssistantChat';

type Tab = 'contatos' | 'enviar';

export default function NovidadesPage() {
  const [tab, setTab] = useState<Tab>('contatos');
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    try {
      const r = await fetch('/api/contacts');
      const data = await r.json();
      if (data.success) setActive(data.data.filter((c: { status: string }) => c.status === 'ativo').length);
    } catch {
      /* contador é só informativo */
    }
  }, []);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  // "Usar este texto" no ajudante → vai para a mensagem da novidade
  useEffect(() => {
    const onUse = (e: Event) => {
      setTab('enviar');
      setDraft((e as CustomEvent<string>).detail);
    };
    window.addEventListener(USE_EVENT, onUse);
    return () => window.removeEventListener(USE_EVENT, onUse);
  }, []);

  const askHelper = () =>
    openAssistantChat({
      prompt: 'Sugira um texto curto de novidade para mandar aos clientes no WhatsApp, com produtos que temos em estoque. Só o texto, pode usar {nome} para o nome do cliente.',
      offerUse: true,
    });

  const tabCls = (t: Tab) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader eyebrow="Balcão" title="Novidades" subtitle="Avise os clientes pelo WhatsApp: contatos organizados e mensagem pronta para enviar do celular" />

        <div className="flex gap-2">
          <button type="button" className={tabCls('contatos')} onClick={() => setTab('contatos')}>
            Contatos
          </button>
          <button type="button" className={tabCls('enviar')} onClick={() => setTab('enviar')}>
            Enviar novidade
          </button>
        </div>

        {tab === 'contatos' ? <ContactsTab onChanged={loadActive} /> : <SendTab activeCount={active} draft={draft} onDraftUsed={() => setDraft(null)} onAskHelper={askHelper} />}
      </div>
    </Layout>
  );
}
