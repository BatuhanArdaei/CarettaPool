'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Credentials removed from source code — use env vars instead
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
const ADMIN_PASS  = process.env.NEXT_PUBLIC_ADMIN_PASS  ?? '';

interface Stats {
  gallery: number;
  catalogs: number;
  faqs: number;
  dealers: number;
  requests: number;
}

export default function AdminPanel() {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    setLoggedIn(localStorage.getItem('admin_ok') === '1');
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const [g, c, f, d, r] = await Promise.all([
        supabase.from('gallery_items').select('*', { count: 'exact', head: true }),
        supabase.from('catalogs').select('*',      { count: 'exact', head: true }),
        supabase.from('faqs').select('*',          { count: 'exact', head: true }),
        supabase.from('dealers').select('*',       { count: 'exact', head: true }),
        supabase.from('pool_configs').select('*',  { count: 'exact', head: true }),
      ]);
      setStats({
        gallery:  g.count ?? 0,
        catalogs: c.count ?? 0,
        faqs:     f.count ?? 0,
        dealers:  d.count ?? 0,
        requests: r.count ?? 0,
      });
      setLoading(false);
    })();
  }, [loggedIn]);

  function login(e: React.FormEvent) {
    e.preventDefault();
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      localStorage.setItem('admin_ok', '1');
      setLoggedIn(true);
    } else {
      setError('E-posta veya şifre hatalı');
    }
  }

  function logout() {
    localStorage.removeItem('admin_ok');
    setLoggedIn(false);
  }

  /* ─── Login screen ──────────────────────────────────────────────── */
  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
              <IconShield />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Giriş</h1>
          </div>
          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="label">E-posta</label>
              <input type="email" className="input" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="label">Şifre</label>
              <input type="password" className="input" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full">Giriş Yap</button>
          </form>
        </div>
      </div>
    );
  }

  /* ─── Dashboard ─────────────────────────────────────────────────── */
  const sections = [
    {
      href: '/admin-panel/galeri',
      title: 'Galeri Yönetimi',
      desc: 'Fotoğraf yükle, kategorize et, yayınla',
      count: stats?.gallery,
      unit: 'görsel',
      color: 'bg-blue-50 text-blue-600',
      icon: <IconImage />,
    },
    {
      href: '/admin-panel/kataloglar',
      title: 'Katalog Yönetimi',
      desc: 'PDF katalog ekle, dil & bayrak otomatik',
      count: stats?.catalogs,
      unit: 'katalog',
      color: 'bg-purple-50 text-purple-600',
      icon: <IconDoc />,
    },
    {
      href: '/admin-panel/sss',
      title: 'S.S.S',
      desc: 'Soru-cevap ekle, önizle, yayına al',
      count: stats?.faqs,
      unit: 'soru',
      color: 'bg-amber-50 text-amber-600',
      icon: <IconQuestion />,
    },
    {
      href: '/admin-panel/bayiler',
      title: 'Bayiler',
      desc: 'Bayi listesi ve indirim oranları',
      count: stats?.dealers,
      unit: 'bayi',
      color: 'bg-green-50 text-green-600',
      icon: <IconBuilding />,
    },
    {
      href: '/admin-panel/ayarlar',
      title: 'Site Ayarları',
      desc: 'Sosyal medya, iletişim, konum',
      count: null,
      unit: '',
      color: 'bg-slate-100 text-slate-600',
      icon: <IconGear />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
              <IconShield />
            </div>
            <span className="text-lg font-bold text-slate-900">CarettaPool Admin</span>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              ← Siteye Dön
            </Link>
            <button onClick={logout} className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Stats bar */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Görsel',        value: stats?.gallery },
            { label: 'Katalog',       value: stats?.catalogs },
            { label: 'S.S.S',         value: stats?.faqs },
            { label: 'Bayi',          value: stats?.dealers },
            { label: 'Teklif Talebi', value: stats?.requests },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
              <p className="text-2xl font-bold text-brand-600">
                {loading ? '…' : (s.value ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Section cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(s => (
            <Link key={s.href} href={s.href}
              className="group flex gap-4 rounded-xl bg-white p-6 ring-1 ring-slate-200 transition-all hover:shadow-lg hover:ring-brand-300">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{s.title}</h3>
                  {s.count !== null && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {loading ? '…' : s.count} {s.unit}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent requests */}
        <RecentRequests />
      </div>
    </div>
  );
}

function RecentRequests() {
  const supabase = createClient();
  const [rows, setRows]  = useState<{ id: string; total_price: number; created_at: string }[]>([]);

  useEffect(() => {
    supabase.from('pool_configs')
      .select('id, total_price, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  if (!rows.length) return null;

  return (
    <div className="mt-8 rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 className="mb-4 font-semibold text-slate-900">Son Teklif Talepleri</h2>
      <div className="divide-y divide-slate-100">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between py-3 text-sm">
            <span className="font-mono text-xs text-slate-400">{r.id.slice(0, 12)}…</span>
            <span className="text-slate-500">{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
            <span className="font-semibold text-slate-900">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(r.total_price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────────── */
const s = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-5 w-5' };

function IconShield()    { return <svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconImage()     { return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>; }
function IconDoc()       { return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>; }
function IconQuestion()  { return <svg {...s}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconBuilding()  { return <svg {...s}><path d="M3 21h18M9 21V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v16M9 10H5a2 2 0 0 0-2 2v9"/><path d="M13 10h4a2 2 0 0 1 2 2v9"/></svg>; }
function IconGear()      { return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
