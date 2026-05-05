'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminAyarlar() {
  const supabase = createClient();
  const [contact, setContact] = useState({ phones: ['', ''], email: '', address: '' });
  const [social, setSocial] = useState({ instagram: '', facebook: '', linkedin: '', youtube: '', tiktok: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('site_settings').select('*');
      data?.forEach(r => {
        if (r.key === 'contact') setContact(r.value as typeof contact);
        if (r.key === 'social') setSocial(r.value as typeof social);
      });
    })();
  }, []);

  async function saveContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await supabase.from('site_settings').upsert({ key: 'contact', value: contact, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setMsg('İletişim bilgileri kaydedildi');
  }

  async function saveSocial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await supabase.from('site_settings').upsert({ key: 'social', value: social, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setMsg('Sosyal medya kaydedildi');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Site Ayarları</h1>
      {msg && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{msg}</p>}

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">İletişim Bilgileri</h2>
        <form onSubmit={saveContact} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Telefon 1</label>
              <input className="input" value={contact.phones[0] ?? ''} onChange={e => setContact(p => ({ ...p, phones: [e.target.value, p.phones[1]] }))} /></div>
            <div><label className="label">Telefon 2</label>
              <input className="input" value={contact.phones[1] ?? ''} onChange={e => setContact(p => ({ ...p, phones: [p.phones[0], e.target.value] }))} /></div>
          </div>
          <div><label className="label">E-Posta</label>
            <input type="email" className="input" value={contact.email} onChange={e => setContact(p => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="label">Adres</label>
            <textarea className="input" rows={2} value={contact.address} onChange={e => setContact(p => ({ ...p, address: e.target.value }))} /></div>
          <button type="submit" className="btn-primary">Kaydet</button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Sosyal Medya</h2>
        <form onSubmit={saveSocial} className="space-y-3">
          {(Object.keys(social) as (keyof typeof social)[]).map(k => (
            <div key={k}>
              <label className="label capitalize">{k}</label>
              <input type="url" className="input" value={social[k]} onChange={e => setSocial(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" className="btn-primary">Kaydet</button>
        </form>
      </div>
    </div>
  );
}
