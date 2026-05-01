import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'CarettaPool — Hayalinizdeki Havuzu Tasarlayın',
  description:
    'CarettaPool ile lüks ve dayanıklı havuz çözümleri. 3D konfigüratörümüzle havuzunuzu kendiniz tasarlayın.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
