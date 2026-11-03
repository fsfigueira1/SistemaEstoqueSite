'use client';

// Guias do Atendimento: as telas de conversa com o cliente ficam juntas.
// Cada guia continua sendo uma página própria (links e "Levar para o PDV"
// seguem funcionando); o menu lateral mostra só "Atendimento".

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, Contact, GraduationCap, Megaphone, MessagesSquare } from 'lucide-react';

export const ATENDIMENTO_TABS = [
  { name: 'Conversa', href: '/atendimento', icon: MessagesSquare },
  { name: 'Lista escolar', href: '/lista-escolar', icon: GraduationCap },
  { name: 'Orçamentos', href: '/orcamentos', icon: ClipboardCheck },
  { name: 'Novidades', href: '/novidades', icon: Megaphone },
  { name: 'Contatos', href: '/contatos', icon: Contact },
] as const;

export default function AtendimentoTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Guias do Atendimento" className="-mx-1 overflow-x-auto px-1">
      <div className="flex w-max gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {ATENDIMENTO_TABS.map((t) => {
          const Icon = t.icon;
          const active = pathname === t.href || pathname?.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
