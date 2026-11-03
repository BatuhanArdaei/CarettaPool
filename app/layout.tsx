import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: { icon: '/carettapool_icon.png', apple: '/carettapool_icon.png' },
  title: 'CarettaPool',
  description: 'Innovative modular pool solutions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
