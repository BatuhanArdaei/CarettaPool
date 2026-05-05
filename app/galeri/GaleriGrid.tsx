'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

interface Photo {
  id: string;
  src_url: string;
  alt: string;
  category: 'havuz' | 'fuar' | 'fabrika';
}

type Filter = 'tumu' | 'havuz' | 'fuar' | 'fabrika';

const FILTER_KEYS: { key: Filter; tKey: string }[] = [
  { key: 'tumu',    tKey: 'gallery.all' },
  { key: 'havuz',   tKey: 'gallery.pool' },
  { key: 'fuar',    tKey: 'gallery.fair' },
  { key: 'fabrika', tKey: 'gallery.factory' },
];

export default function GaleriGrid() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState<Filter>('tumu');
  const { t } = useLanguage();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('gallery_items')
      .select('id, src_url, alt, category')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPhotos(data ?? []));
  }, []);

  const visible = active === 'tumu' ? photos : photos.filter(p => p.category === active);
  const count = (k: Filter) => k === 'tumu' ? photos.length : photos.filter(p => p.category === k).length;

  return (
    <>
      {/* Filter buttons */}
      <div className="mt-10 flex flex-wrap gap-2">
        {FILTER_KEYS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActive(f.key)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
              active === f.key ? 'bg-brand-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t(f.tKey)}
            <span className={`ml-2 text-xs ${active === f.key ? 'text-white/80' : 'text-slate-400'}`}>
              {count(f.key)}
            </span>
          </button>
        ))}
      </div>

      {/* Photo grid */}
      <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {visible.map(p => (
          <div
            key={p.id}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
          >
            <Image
              src={p.src_url}
              alt={p.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-16 text-center text-slate-400">
          {photos.length === 0 ? 'Yükleniyor…' : 'Bu kategoride fotoğraf yok.'}
        </p>
      )}
    </>
  );
}
