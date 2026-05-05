'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LANGUAGES = [
  { name: 'Türkçe', code: 'tr', flag: '🇹🇷' },
  { name: 'English', code: 'en', flag: '🇬🇧' },
  { name: 'Deutsch', code: 'de', flag: '🇩🇪' },
  { name: 'Español', code: 'es', flag: '🇪🇸' },
  { name: 'Français', code: 'fr', flag: '🇫🇷' },
  { name: 'Italiano', code: 'it', flag: '🇮🇹' },
  { name: 'Polski', code: 'pl', flag: '🇵🇱' },
  { name: 'Русский', code: 'ru', flag: '🇷🇺' },
  { name: 'العربية', code: 'ar', flag: '🇸🇦' },
];

interface Catalog { id: string; language: string; flag: string; file_url: string; published: boolean; storage_path: string; }

export default function AdminKataloglar() {
  const supabase = createClient();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [selLang, setSelLang] = useState(LANGUAGES[1]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('catalogs').select('*').order('created_at', { ascending: false });
    setCatalogs(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const [title, setTitle] = useState('');

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.type !== 'application/pdf') { setMsg('Sadece PDF kabul edilir'); return; }
    setUploading(true); setMsg('');
    try {
      const path = `catalogs/${selLang.code}-${Date.now()}.pdf`;
      const { error } = await supabase.storage.from('catalogs').upload(path, file, { contentType: 'application/pdf' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('catalogs').getPublicUrl(path);
      await supabase.from('catalogs').insert({
        language: selLang.name,
        language_code: selLang.code,
        flag: selLang.flag,
        title: title.trim() || `${selLang.name} Kataloğu`,
        file_url: publicUrl,
        storage_path: path,
        published: true
      });
      setMsg('Katalog yüklendi!'); setFile(null); setTitle(''); load();
    } catch (err) { setMsg((err as Error).message); }
    setUploading(false);
  }

  async function toggle(c: Catalog) {
    await supabase.from('catalogs').update({ published: !c.published }).eq('id', c.id);
    load();
  }

  async function remove(c: Catalog) {
    await supabase.storage.from('catalogs').remove([c.storage_path]);
    await supabase.from('catalogs').delete().eq('id', c.id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Katalog Yönetimi</h1>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Yeni Katalog Ekle</h2>
        <form onSubmit={upload} className="space-y-4">
          <div>
            <label className="label">Dil Seç</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(l => (
                <button key={l.code} type="button" onClick={() => setSelLang(l)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${selLang.code === l.code ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-600'}`}>
                  <span>{l.flag}</span> {l.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Katalog Adı</label>
            <input
              type="text"
              className="input"
              placeholder={`${selLang.name} Kataloğu`}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Boş bırakırsan "{selLang.name} Kataloğu" olarak kaydedilir.</p>
          </div>
          <div>
            <label className="label">PDF Dosyası</label>
            <input type="file" accept=".pdf,application/pdf" className="input" onChange={e => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          {msg && <p className="text-sm text-brand-600">{msg}</p>}
          <button type="submit" className="btn-primary" disabled={uploading || !file}>
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Kataloglar ({catalogs.length})</h2>
        <div className="space-y-3">
          {catalogs.map(c => (
            <div key={c.id} className="flex items-center gap-4 rounded-lg p-4 ring-1 ring-slate-200">
              <span className="text-3xl">{c.flag}</span>
              <div className="flex-1">
                <p className="font-semibold">{(c as any).title || c.language}</p>
                <p className="text-xs text-slate-500">{c.language} • {c.flag}</p>
                <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">Görüntüle</a>
              </div>
              <button onClick={() => toggle(c)} className={`rounded px-3 py-1.5 text-xs font-medium ${c.published ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {c.published ? 'Yayında' : 'Gizli'}
              </button>
              <button onClick={() => remove(c)} className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Sil</button>
            </div>
          ))}
          {!catalogs.length && <p className="text-sm text-slate-500">Henüz katalog yok.</p>}
        </div>
      </div>
    </div>
  );
}
