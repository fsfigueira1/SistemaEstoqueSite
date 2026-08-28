'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { LayoutDashboard, ShoppingCart, Package, BarChart3, List, Users, Settings } from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'PDV', href: '/pdv', icon: ShoppingCart, isActive: true },
  { name: 'Estoque', href: '/estoque', icon: Package },
  { name: 'Produtos', href: '/produtos', icon: List },
  { name: 'Vendas', href: '/vendas', icon: Users },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg flex items-center justify-center">
              <div className="text-white text-sm font-bold">L</div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Laçolaria ERP</h1>
              <p className="text-xs text-gray-500 mt-0.5">Sistema de Gestão Commercial</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'hover:bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}/>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          Versão 1.0 • Laçolaria
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 bg-gray-50">{children}</main>
    </div>
  );
}