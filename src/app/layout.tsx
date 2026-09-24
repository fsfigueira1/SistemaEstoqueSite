import './globals.css';
import type { Metadata } from 'next';
// Fontes locais (sem Google Fonts): o build e o app funcionam offline.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/fraunces/opsz.css';
import AppWrapper from '@/app/AppWrapper';

export const metadata: Metadata = {
  title: 'Laçolaria — Gestão',
  description: 'Sistema de gestão e PDV da papelaria Laçolaria',
  icons: {
    icon: '/logo.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
