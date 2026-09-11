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
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const nav = [
  { name: 'Painel', href: '/dashboard', icon: LayoutDashboard },
  { name: 'PDV', href: '/pdv', icon: ShoppingCart },
  { name: 'Estoque', href: '/estoque', icon: Package },
  { name: 'Produtos', href: '/produtos', icon: List },
  { name: 'Vendas', href: '/vendas', icon: Receipt },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const Rail = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <img
          src="/logo.png"
          alt="Laçolaria"
          className="h-10 w-10 shrink-0 rounded-xl bg-white object-cover shadow-sm ring-1 ring-black/5"
        />
        <span className="leading-tight">
          <span className="block font-heading text-lg font-bold tracking-tight text-foreground">
            Laçolaria
          </span>
          <span className="block text-[11px] text-muted-foreground">Gestão &amp; PDV</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent-soft text-accent-soft-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
              />
              {item.name}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        <ThemeToggle />
        <p className="px-3 pt-1 text-[11px] text-muted-foreground">v1.0 · Laçolaria</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">{Rail}</aside>

      {/* mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-xl">
            {Rail}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg bg-white object-cover ring-1 ring-black/5" />
          <span className="font-heading font-bold">Laçolaria</span>
        </header>

        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
