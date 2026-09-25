'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  List,
  Receipt,
  Settings,
  Menu,
  X,
  NotebookPen,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import DailyAssistant, { openDailyAssistant } from '@/components/DailyAssistant';

// Navegação em grupos: o que se usa no balcão primeiro, gestão depois.
const groups: Array<{ title: string; items: Array<{ name: string; href: string; icon: typeof LayoutDashboard }> }> = [
  {
    title: 'Balcão',
    items: [
      { name: 'Painel', href: '/dashboard', icon: LayoutDashboard },
      { name: 'PDV', href: '/pdv', icon: ShoppingCart },
      { name: 'Vendas', href: '/vendas', icon: Receipt },
      { name: 'Lista escolar', href: '/lista-escolar', icon: GraduationCap },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { name: 'Produtos', href: '/produtos', icon: List },
      { name: 'Estoque', href: '/estoque', icon: Package },
      { name: 'Compras', href: '/compras', icon: ClipboardList },
      { name: 'Relatórios', href: '/relatorios', icon: NotebookPen },
      { name: 'Configurações', href: '/configuracoes', icon: Settings },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const Rail = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <img
          src="/logo.png"
          alt="Laçolaria"
          className="h-11 w-11 shrink-0 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-white/20"
        />
        <span className="leading-tight">
          <span className="block font-heading text-[1.35rem] font-semibold tracking-tight">Laçolaria</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">
            Papelaria fina
          </span>
        </span>
      </div>

      <div className="mx-5 h-px bg-sidebar-border" />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted/80">
              {g.title}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-sidebar-active text-sidebar-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground'
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" aria-hidden />
                    )}
                    <Icon
                      className={`h-[18px] w-[18px] ${active ? 'text-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground'}`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-4">
        <button
          onClick={() => {
            setOpen(false);
            openDailyAssistant();
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-active px-3 py-2.5 text-left transition-colors hover:border-primary/50"
        >
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-cover" />
          <span className="leading-tight">
            <span className="block text-sm font-medium">Resumo do dia</span>
            <span className="block text-[11px] text-sidebar-muted">Pergunte à assistente</span>
          </span>
        </button>
        <div className="flex items-center justify-between px-1">
          <ThemeToggle />
          <span className="text-[10px] text-sidebar-muted">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* desktop */}
      <aside className="hidden w-64 shrink-0 lg:block">{Rail}</aside>

      {/* mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-xl">{Rail}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg bg-white object-cover ring-1 ring-black/5" />
          <span className="font-heading text-lg font-semibold">Laçolaria</span>
        </header>

        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>

      <DailyAssistant />
    </div>
  );
}

/** Cabeçalho padrão das páginas: sobrescrito + título com serifa + filete. */
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
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="text-[1.9rem] leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="rule-accent" />
    </div>
  );
}
