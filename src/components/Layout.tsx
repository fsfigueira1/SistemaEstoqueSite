'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import DailyAssistant, { openDailyAssistant } from '@/components/DailyAssistant';
import AssistantChat from '@/components/AssistantChat';
import AgentAlerts from '@/components/AgentAlerts';
import KodaLogo from '@/components/KodaLogo';
import { canAccess } from '@/lib/access';
import { logout, useMe } from '@/lib/useMe';

// Navegação em grupos: o que se usa no balcão primeiro, gestão depois. Cada
// perfil vê só o que pode abrir (src/lib/access.ts — o servidor barra o resto).
// "Atendimento" reúne Lista escolar, Orçamentos, Novidades e Contatos como
// guias (AtendimentoTabs); o item do menu fica aceso em qualquer uma delas.
// Visual koda: barra escura no topo, abas numa linha, aba ativa sublinhada.
const groups: Array<{
  title: string;
  items: Array<{ name: string; href: string; also?: string[] }>;
}> = [
  {
    title: 'Balcão',
    items: [
      { name: 'Painel', href: '/dashboard' },
      { name: 'PDV', href: '/pdv' },
      { name: 'Vendas', href: '/vendas' },
      {
        name: 'Atendimento',
        href: '/atendimento',
        also: ['/lista-escolar', '/orcamentos', '/novidades', '/contatos'],
      },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { name: 'Produtos', href: '/produtos' },
      { name: 'Etiquetas', href: '/etiquetas' },
      { name: 'Estoque', href: '/estoque' },
      { name: 'Revisão de cadastro', href: '/revisao' },
      { name: 'Compras', href: '/compras' },
      { name: 'Relatórios', href: '/relatorios' },
      { name: 'Ciranda (APM)', href: '/ciranda' },
      { name: 'Configurações', href: '/configuracoes' },
    ],
  },
];

/** Relógio "Ao vivo" do topo (só no navegador, para não divergir do servidor). */
function LiveClock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden items-center gap-2 font-mono text-xs text-sidebar-muted md:inline-flex">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Ao vivo{now ? ` · ${now}` : ''}
    </span>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const isOwner = me?.role === 'OWNER';
  // menu só depois de saber o perfil (não pisca item que o balcão não pode abrir)
  const visible = me
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(me.role, i.href)) })).filter((g) => g.items.length)
    : [];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="shrink-0 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-4 pt-3 sm:gap-4 sm:px-8 sm:pt-4">
          <Link href={me?.home ?? '/'} aria-label="Início" className="shrink-0">
            <KodaLogo className="h-6 w-auto text-cream sm:h-7" />
          </Link>
          <span className="hidden items-center gap-2 rounded-full border border-sidebar-border py-1 pl-1 pr-4 sm:inline-flex">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-active font-heading text-xs font-bold">L</span>
            <span className="text-sm font-semibold">Laçolaria</span>
            <span className="text-sm text-sidebar-muted">Papelaria fina</span>
          </span>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <LiveClock />
            {isOwner && (
              <button
                type="button"
                onClick={openDailyAssistant}
                title="Resumo do dia — pergunte à assistente"
                className="inline-flex items-center gap-2 rounded-full border border-sidebar-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-sidebar-active"
              >
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                Assistente
              </button>
            )}
            <ThemeToggle />
            {me && (
              <span className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream font-heading text-sm font-bold text-ink">
                  {me.label.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-semibold">{me.label}</span>
                  <button
                    type="button"
                    onClick={logout}
                    className="block text-xs text-sidebar-muted transition-colors hover:text-sidebar-foreground"
                  >
                    Sair
                  </button>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-sidebar-muted hover:text-sidebar-foreground sm:hidden"
                >
                  Sair
                </button>
              </span>
            )}
          </div>
        </div>

        <nav aria-label="Menu" className="mt-2 flex items-stretch gap-1 overflow-x-auto px-4 sm:px-8">
          {visible.map((g, gi) => (
            <div key={g.title} className="flex shrink-0 items-stretch">
              {gi > 0 && <span className="mx-3 my-3 w-px bg-sidebar-border" aria-hidden />}
              <span className="flex items-center pr-3 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-muted/80">
                {g.title}
              </span>
              {g.items.map((item) => {
                const active = [item.href, ...(item.also ?? [])].some(
                  (h) => pathname === h || pathname?.startsWith(h + '/'),
                );
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center whitespace-nowrap px-3.5 pb-3.5 pt-2.5 text-[15px] font-medium transition-colors ${
                      active ? 'text-sidebar-foreground' : 'text-sidebar-muted hover:text-sidebar-foreground'
                    }`}
                  >
                    {item.name}
                    {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-primary" aria-hidden />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>

      {isOwner && <DailyAssistant />}
      <AssistantChat />
      {me && <AgentAlerts />}
    </div>
  );
}

/** Cabeçalho padrão das páginas: data/sobrescrito em mono + título grande. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-[2.4rem] leading-[1.05] tracking-[-0.03em] text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="rule-accent" />
    </div>
  );
}
