'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const CATS = ['havuz', 'fuar', 'fabrika'] as const;
type Cat = typeof CATS[number];

interface GalleryItem {
  id: string; src_url: string; alt: string;
  category: Cat; published: boolean; storage_path: string;
}

export default function AdminGaleri() {
  const supabase = createClient();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [category, setCategory] = useState<Cat>('havuz');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const { data } = await supabase.from('gallery_items').select('*').order('created_at', { ascending: false });
    setItems(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const ext = file.name.split('.').pop();
      const path = `gallery/${category}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(path);
      await supabase.from('gallery_items').insert({ src_url: publicUrl, storage_path: path, alt: file.name, category, published: true });
      setMsg('Yüklendi!'); setFile(null); setPreview(null);
      formRef.current?.reset(); load();
    } catch (err) { setMsg((err as Error).message); }
    setUploading(false);
  }

  async function toggle(item: GalleryItem) {
    await supabase.from('gallery_items').update({ published: !item.published }).eq('id', item.id);
    load();
  }

  async function remove(item: GalleryItem) {
    await supabase.storage.from('gallery').remove([item.storage_path]);
    await supabase.from('gallery_items').delete().eq('id', item.id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Galeri Yönetimi</h1>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Görsel Yükle</h2>
        <form ref={formRef} onSubmit={upload} className="space-y-4">
          <div>
            <label className="label">Kategori</label>
            <div className="flex gap-2">
              {CATS.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize ${category === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-6 ${preview ? 'border-brand-400' : 'border-slate-300'}`}>
            {preview ? <Image src={preview} alt="" width={200} height={150} className="object-contain" /> :
              <span className="text-sm text-slate-500">Görsel seç (JPEG / PNG / WebP)</span>}
            <input type="file" accept="image/*" className="sr-only" onChange={e => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : null);
            }} />
          </label>
          {msg && <p className="text-sm text-brand-600">{msg}</p>}
          <button type="submit" className="btn-primary w-full" disabled={uploading || !file}>
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Mevcut Görseller ({items.length})</h2>
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map(item => (
            <div key={item.id} className={`overflow-hidden rounded-lg ring-1 ${item.published ? 'ring-slate-200' : 'ring-red-200 opacity-60'}`}>
              <div className="relative aspect-[4/3] bg-slate-100">
                <Image src={item.src_url} alt={item.alt} fill className="object-cover" sizes="200px" />
              </div>
              <div className="flex gap-1 p-2">
                <span className="mr-auto text-[11px] text-slate-500 capitalize">{item.category}</span>
                <button onClick={() => toggle(item)} className={`rounded px-2 py-1 text-[11px] font-medium ${item.published ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {item.published ? 'Yayında' : 'Gizli'}
                </button>
                <button onClick={() => remove(item)} className="rounded px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Sil</button>
              </div>
            </div>
          ))}
          {!items.length && <p className="col-span-full text-sm text-slate-500">Henüz görsel yok.</p>}
        </div>
      </div>
    </div>
  );
}
