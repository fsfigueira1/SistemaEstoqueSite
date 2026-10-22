'use client';

// Novidades: contatos (planilha, clientes, WhatsApp) e envio da novidade pelo
// WhatsApp Business do celular. Sem a API da Meta por enquanto — quando ela
// voltar, esta tela ganha o envio automático.

import { useCallback, useEffect, useState } from 'react';
import Layout, { PageHeader } from '@/components/Layout';
import ContactsTab from '@/components/novidades/ContactsTab';
import SendTab from '@/components/novidades/SendTab';

type Tab = 'contatos' | 'enviar';

export default function NovidadesPage() {
  const [tab, setTab] = useState<Tab>('contatos');
  const [active, setActive] = useState(0);

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

        {tab === 'contatos' ? <ContactsTab onChanged={loadActive} /> : <SendTab activeCount={active} />}
      </div>
    </Layout>
  );
}
