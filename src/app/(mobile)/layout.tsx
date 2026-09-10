import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Laçolaria — Consulta',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Laçolaria',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function MobileGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
