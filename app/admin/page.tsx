'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function AdminPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({ gallery: 0, catalogs: 0, faqs: 0, dealers: 0, requests: 0, contact: 0 });
  const [requests, setRequests] = useState<{ id: string; total_price: number; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [g, c, f, d, r, ct] = await Promise.all([
        supabase.from('gallery_items').select('*', { count: 'exact', head: true }),
        supabase.from('catalogs').select('*', { count: 'exact', head: true }),
        supabase.from('faqs').select('*', { count: 'exact', head: true }),
        supabase.from('dealers').select('*', { count: 'exact', head: true }),
        supabase.from('pool_configs').select('*', { count: 'exact', head: true }),
        supabase.from('contact_requests').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ gallery: g.count ?? 0, catalogs: c.count ?? 0, faqs: f.count ?? 0, dealers: d.count ?? 0, requests: r.count ?? 0, contact: ct.count ?? 0 });

      const { data } = await supabase.from('pool_configs').select('id, total_price, created_at').order('created_at', { ascending: false }).limit(5);
      setRequests(data ?? []);
    })();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

/* ─── SVG Icons ─────────────────────────────────────────────── */
const ic = { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.75, strokeLinecap:'round' as const, strokeLinejoin:'round' as const, className:'h-5 w-5' };
function IconPhoto()    { return <svg {...ic}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>; }
function IconDoc()      { return <svg {...ic}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>; }
function IconFaq()      { return <svg {...ic}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconBuilding() { return <svg {...ic}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><line x1="10" y1="6" x2="10" y2="6.01"/><line x1="14" y1="6" x2="14" y2="6.01"/><line x1="10" y1="10" x2="10" y2="10.01"/><line x1="14" y1="10" x2="14" y2="10.01"/><line x1="10" y1="14" x2="10" y2="14.01"/><line x1="14" y1="14" x2="14" y2="14.01"/><line x1="10" y1="18" x2="10" y2="18.01"/><line x1="14" y1="18" x2="14" y2="18.01"/></svg>; }
function IconGear()      { return <svg {...ic}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IconPool()      { return <svg {...ic}><path d="M2 12h20M2 6c1.5 2 3 3 5 3s3.5-1 5-3 3.5-3 5-3M2 18c1.5 2 3 3 5 3s3.5-1 5-3 3.5-3 5-3"/></svg>; }
function IconMail()      { return <svg {...ic}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function IconBriefcase() { return <svg {...ic}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12.01"/><path d="M2 12h8m4 0h8"/></svg>; }

  const SECTIONS = [
    { href: '/admin/galeri',             title: 'Galeri',              desc: 'Fotoğraf yükle, kategorize et, yayınla',   count: stats.gallery,   unit: 'görsel',  color: 'bg-blue-50 text-blue-600',    icon: <IconPhoto /> },
    { href: '/admin/kataloglar',         title: 'Kataloglar',          desc: 'PDF katalog ekle, dil & bayrak otomatik',   count: stats.catalogs,  unit: 'katalog', color: 'bg-purple-50 text-purple-600', icon: <IconDoc /> },
    { href: '/admin/sss',                title: 'S.S.S',               desc: 'Soru-cevap ekle, önizle, yayına al',       count: stats.faqs,      unit: 'soru',    color: 'bg-amber-50 text-amber-600',   icon: <IconFaq /> },
    { href: '/admin/bayiler',            title: 'Bayiler',             desc: 'Bayi listesi ve indirim oranları',          count: stats.dealers,   unit: 'bayi',    color: 'bg-green-50 text-green-600',   icon: <IconBuilding /> },
    { href: '/admin/talepler',           title: 'Havuz Talepleri',     desc: '3D konfigüratörden gelen teklif talepleri', count: stats.requests,  unit: 'talep',   color: 'bg-cyan-50 text-cyan-600',     icon: <IconPool /> },
    { href: '/admin/iletisim-talepleri', title: 'İletişim Talepleri',  desc: 'İletişim formundan gelen mesajlar',         count: stats.contact,   unit: 'mesaj',   color: 'bg-rose-50 text-rose-600',     icon: <IconMail /> },
    { href: '/admin/bayi-talepleri',     title: 'Bayi Talepleri',      desc: 'Bayilerin havuz konfigürasyon talepleri',   count: null,            unit: '',         color: 'bg-orange-50 text-orange-600', icon: <IconBriefcase /> },
    { href: '/admin/ayarlar',            title: 'Site Ayarları',       desc: 'Sosyal medya, iletişim, konum',             count: null,            unit: '',         color: 'bg-slate-100 text-slate-600',  icon: <IconGear /> },
  ];

  return (
    <div className="space-y-8">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Görsel',           value: stats.gallery },
          { label: 'Katalog',          value: stats.catalogs },
          { label: 'S.S.S',            value: stats.faqs },
          { label: 'Bayi',             value: stats.dealers },
          { label: 'Havuz Talebi',     value: stats.requests },
          { label: 'İletişim Mesajı',  value: stats.contact },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-brand-600">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href}
            className="group flex gap-4 rounded-xl bg-white p-6 ring-1 ring-slate-200 transition-all hover:shadow-lg hover:ring-brand-300">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{s.title}</h3>
                {s.count !== null && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {s.count} {s.unit}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent requests */}
      {requests.length > 0 && (
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="mb-4 font-semibold text-slate-900">Son Teklif Talepleri</h2>
          <div className="divide-y divide-slate-100">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-mono text-xs text-slate-400">{r.id.slice(0, 14)}…</span>
                <span className="text-slate-500">{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
                <span className="font-semibold text-slate-900">{fmt(r.total_price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
