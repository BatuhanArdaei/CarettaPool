'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { localePath, type PageKey } from '@/lib/i18n/routes';

interface Props {
  isAuthenticated: boolean;
  role: string | null;
}

const NAV_PAGES: { page: PageKey | 'home' | 'create'; key: string }[] = [
  { page: 'home',     key: 'nav.home' },
  { page: 'products', key: 'nav.products' },
  { page: 'create',   key: 'nav.create' },
  { page: 'faq',      key: 'nav.faq' },
  { page: 'contact',  key: 'nav.contact' },
  { page: 'gallery',  key: 'nav.gallery' },
  { page: 'catalogs', key: 'nav.catalogs' },
];

export default function NavbarClient({ isAuthenticated, role }: Props) {
  const pathname = usePathname();
  const minimal = pathname?.includes('/create') ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, lang } = useLanguage();

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const links = NAV_PAGES.map((n) => ({
    href: localePath(lang, n.page),
    key:  n.key,
  }));

  if (role === 'admin') {
    links.push({ href: '/admin', key: 'nav.adminPanel' });
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md transition-all">
        <div className="flex h-16 items-center justify-between px-0 sm:h-20 md:h-24">
          <Link href={localePath(lang, 'home')} className="flex shrink-0 items-center pl-0" aria-label="CarettaPool">
            <Image
              src="/carettapool.png"
              alt="CarettaPool"
              width={600}
              height={150}
              priority
              className="h-20 w-auto object-contain sm:h-22 md:h-24"
              style={{ maxWidth: '320px' }}
            />
          </Link>

          {/* Desktop nav */}
          {!minimal && (
            <nav className="hidden items-center gap-6 text-sm lg:flex" style={{ marginLeft: '1rem' }}>
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`transition-colors hover:text-brand-400 ${
                    pathname === l.href ? 'text-brand-400' : 'text-slate-300'
                  }`}
                >
                  {t(l.key)}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2 pr-4 md:pr-6">
            {!minimal && (
              <button
                type="button"
                aria-label={t('nav.menu')}
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 lg:hidden"
              >
                {menuOpen ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}

            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                {role === 'admin' && (
                  <Link href="/admin"
                    className="rounded-lg border border-brand-600 bg-brand-600/10 px-4 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-600/20">
                    {t('nav.adminPanel')}
                  </Link>
                )}
                <form action="/auth/signout" method="post">
                  <button type="submit"
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500 hover:bg-slate-900 hover:text-white">
                    {t('nav.logout')}
                  </button>
                </form>
              </>
            ) : (
              <Link href={localePath(lang, 'login')}
                className="rounded-lg border border-brand-600 bg-brand-600/10 px-4 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-600/20">
                {t('nav.adminLogin')}
              </Link>
            )}

            {!minimal && (
              <Link href={localePath(lang, 'create')}
                className="hidden rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-400 lg:inline-flex">
                {t('nav.startDesign')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <div className={`fixed inset-y-0 right-0 z-40 w-72 bg-slate-950 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <span className="text-sm font-semibold text-white">{t('nav.menu')}</span>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-800 hover:text-white ${
                pathname === l.href ? 'bg-slate-800 text-brand-400' : 'text-slate-300'
              }`}>
              {t(l.key)}
            </Link>
          ))}
          <Link href={localePath(lang, 'create')} onClick={() => setMenuOpen(false)}
            className="mt-3 rounded-lg bg-brand-500 px-4 py-3 text-center text-sm font-medium text-white hover:bg-brand-400">
            {t('nav.startDesign')}
          </Link>
        </nav>
      </div>
    </>
  );
}
