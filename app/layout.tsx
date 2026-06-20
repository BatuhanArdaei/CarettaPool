import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
