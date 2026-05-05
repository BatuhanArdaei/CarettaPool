'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ContactRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
  is_read: boolean;
}

export default function IletisimTalepleriPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<ContactRequest[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('contact_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRows(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await supabase.from('contact_requests').update({ is_read: true }).eq('id', id);
    load();
  }

  async function remove(id: string) {
    await supabase.from('contact_requests').delete().eq('id', id);
    load();
  }

  const unread = rows.filter(r => !r.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">İletişim Talepleri</h1>
          <p className="text-sm text-slate-500">Site iletişim formundan gelen mesajlar.</p>
        </div>
        {unread > 0 && (
          <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
            {unread} yeni
          </span>
        )}
      </div>

      <div className="rounded-xl bg-white ring-1 ring-slate-200">
        {!rows.length ? (
          <p className="p-6 text-sm text-slate-500">Henüz iletişim talebi yok.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.id} className={`p-5 ${!r.is_read ? 'bg-brand-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!r.is_read && (
                        <span className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900">{r.name}</span>
                      <span className="text-sm text-slate-500">{r.email}</span>
                      {r.phone && <span className="text-sm text-slate-500">• {r.phone}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleString('tr-TR')}
                    </p>
                    {open === r.id && (
                      <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                        {r.message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => { setOpen(open === r.id ? null : r.id); if (!r.is_read) markRead(r.id); }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {open === r.id ? 'Gizle' : 'Mesajı Gör'}
                    </button>
                    <a href={`mailto:${r.email}`}
                      className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                      Yanıtla
                    </a>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
