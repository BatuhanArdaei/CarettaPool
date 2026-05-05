'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Faq { id: string; question: string; answer: string; published: boolean; }

export default function AdminSss() {
  const supabase = createClient();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('faqs').select('*').order('created_at');
    setFaqs(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('faqs').insert({ question: q, answer: a, published: false });
    setQ(''); setA(''); setMsg('Eklendi (taslak)'); load();
  }

  async function toggle(f: Faq) {
    await supabase.from('faqs').update({ published: !f.published }).eq('id', f.id);
    load();
  }

  async function remove(id: string) {
    await supabase.from('faqs').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">S.S.S Yönetimi</h1>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Yeni Soru Ekle</h2>
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Soru</label>
            <input className="input" value={q} onChange={e => setQ(e.target.value)} required />
          </div>
          <div>
            <label className="label">Cevap</label>
            <textarea className="input" rows={3} value={a} onChange={e => setA(e.target.value)} required />
          </div>
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <button type="submit" className="btn-primary">Ekle (taslak)</button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Sorular ({faqs.length})</h2>
        <div className="space-y-3">
          {faqs.map(f => (
            <details key={f.id} className={`group rounded-lg ring-1 ${f.published ? 'ring-slate-200' : 'ring-amber-200 bg-amber-50/40'}`}>
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-sm font-medium text-slate-900">{f.question}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${f.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {f.published ? 'Yayında' : 'Taslak'}
                </span>
              </summary>
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <p className="text-sm text-slate-600">{f.answer}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => toggle(f)} className="btn-outline text-xs">{f.published ? 'Taslağa Al' : 'Yayına Al'}</button>
                  <button onClick={() => remove(f.id)} className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Sil</button>
                </div>
              </div>
            </details>
          ))}
          {!faqs.length && <p className="text-sm text-slate-500">Henüz soru yok.</p>}
        </div>
      </div>
    </div>
  );
}
