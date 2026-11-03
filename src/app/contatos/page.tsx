'use client';

// Contatos: a lista de clientes do WhatsApp (planilha, clientes do PDV,
// celular), quem aceitou receber novidades e quem pediu para sair. Era uma
// aba dentro de Novidades; agora é uma guia do Atendimento.

import Layout, { PageHeader } from '@/components/Layout';
import AtendimentoTabs from '@/components/atendimento/AtendimentoTabs';
import ContactsTab from '@/components/novidades/ContactsTab';

export default function ContatosPage() {
  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader eyebrow="Balcão" title="Contatos" subtitle="Clientes do WhatsApp: quem recebe novidades, quem pediu para sair e de onde veio cada um" />
        <AtendimentoTabs />
        <ContactsTab />
      </div>
    </Layout>
  );
}
