'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LayoutDashboard, List, Package, Receipt, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/m/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/m/produtos', label: 'Produtos', icon: List },
  { href: '/m/estoque', label: 'Estoque', icon: Package },
  { href: '/m/vendas', label: 'Vendas', icon: Receipt },
  { href: '/m/relatorio', label: 'Relatório', icon: FileBarChart },
];

export default function MobileLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card/70 px-4 py-3 backdrop-blur">
        <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg bg-white object-cover ring-1 ring-black/5" />
        <span className="font-heading font-bold">Laçolaria</span>
        <span className="ml-auto text-[11px] text-muted-foreground">consulta</span>
      </header>

      <main className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="grid grid-cols-5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
