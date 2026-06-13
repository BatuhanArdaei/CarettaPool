'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin',             label: 'Genel',             exact: true },
  { href: '/admin/galeri',      label: 'Galeri' },
  { href: '/admin/kataloglar',  label: 'Kataloglar' },
  { href: '/admin/sss',         label: 'S.S.S' },
  { href: '/admin/fiyatlar',    label: 'Fiyat Yönetimi' },
  { href: '/admin/bayiler',     label: 'Bayiler' },
  { href: '/admin/talepler',          label: 'Havuz Talepleri' },
  { href: '/admin/iletisim-talepleri',label: 'İletişim Talepleri' },
  { href: '/admin/bayi-talepleri',    label: 'Bayi Talepleri' },
  { href: '/admin/ayarlar',     label: 'Site Ayarları' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
