'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const tabs = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Venda (PDV)', href: '/pdv' },
    { name: 'Estoque', href: '/estoque' },
  ];

  return (
    <nav className="bg-dark-green p-4">
      <div className="container mx-auto flex space-x-4">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              pathname === tab.href
                ? 'bg-pale-gold text-dark-green'
                : 'text-pale-gold hover:bg-dark-green/20 hover:text-pale-gold'
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}