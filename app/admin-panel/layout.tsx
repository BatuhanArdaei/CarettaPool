'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/admin-panel',           label: 'Ana Sayfa' },
  { href: '/admin-panel/galeri',    label: 'Galeri' },
  { href: '/admin-panel/kataloglar',label: 'Kataloglar' },
  { href: '/admin-panel/sss',       label: 'S.S.S' },
  { href: '/admin-panel/bayiler',   label: 'Bayiler' },
  { href: '/admin-panel/ayarlar',   label: 'Site Ayarları' },
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Giriş sayfasının kendisine auth kontrolü yapma
    if (pathname === '/admin-panel') { setReady(true); return; }
    if (localStorage.getItem('admin_ok') !== '1') {
      router.replace('/admin-panel');
    } else {
      setReady(true);
    }
  }, [router, pathname]);

  if (!ready) return null;
  // Giriş sayfasını layout olmadan göster
  if (pathname === '/admin-panel') return <>{children}</>;

  function logout() {
    localStorage.removeItem('admin_ok');
    router.push('/admin-panel');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/admin-panel" className="text-base font-bold text-slate-900 shrink-0">
            CarettaPool Admin
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Siteye Dön</Link>
            <button onClick={logout}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
