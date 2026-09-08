import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AppWrapper from '@/app/AppWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Laçolaria ERP',
  description: 'ERP system for stationery stores',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="antialiased">
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}