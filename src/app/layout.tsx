import './globals.css';
import type { Metadata } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import AppWrapper from '@/app/AppWrapper';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Laçolaria — Gestão',
  description: 'Sistema de gestão e PDV da papelaria Laçolaria',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
