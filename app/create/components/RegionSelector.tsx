'use client';

import { useState } from 'react';
import Image from 'next/image';
import { REGIONS, type Region } from '@/lib/regions';

const flagUrl = (c: string) =>
  c === 'eu' ? 'https://flagcdn.com/w80/eu.png'
  : c === 'un' ? 'https://flagcdn.com/w80/un.png'
  : `https://flagcdn.com/w80/${c}.png`;

/* ─── Main ─────────────────────────────────────────────── */
export default function RegionSelector({ onSelect }: { onSelect: (r: Region) => void }) {
  const [selected, setSelected] = useState<Region>(REGIONS[0]);
  const [out, setOut]           = useState(false);

  const confirm = () => {
    setOut(true);
    setTimeout(() => onSelect(selected), 400);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm transition-opacity duration-400 ${out ? 'opacity-0' : 'opacity-100'}`}>
      <div className="w-full max-w-3xl space-y-6">

        {/* Title */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Adım 1</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Teslimat Bölgesi Seçin</h1>
          <p className="mt-1 text-sm text-slate-400">Bölgenize göre havuz boyut sınırları otomatik ayarlanır</p>
        </div>

        {/* Cards — horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 sm:justify-center sm:overflow-visible">
          {REGIONS.map(r => {
            const active = selected.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`group flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 sm:w-40 ${
                  active
                    ? 'border-cyan-400 bg-slate-800/80 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800/40'
                }`}
              >
                {/* Flag */}
                <div className="relative h-7 w-11 overflow-hidden rounded-md shadow-sm">
                  <Image src={flagUrl(r.countryCode)} alt={r.name} fill sizes="44px" className="object-cover" unoptimized />
                </div>

                {/* Name */}
                <div className="text-center">
                  <p className={`text-sm font-bold leading-tight ${active ? 'text-cyan-300' : 'text-white'}`}>
                    {r.name}
                  </p>
                  <p className="text-[10px] text-slate-400">{r.countryCode.toUpperCase()}</p>
                </div>

                {/* Select label */}
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200'
                }`}>
                  {active ? '✓ Seçildi' : 'Seç'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Info + CTA */}
        <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/90 shadow-2xl">
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md">
              <Image src={flagUrl(selected.countryCode)} alt={selected.name} fill sizes="56px" className="object-cover" unoptimized />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">{selected.name}</p>
              <p className="truncate text-xs text-slate-400">{selected.note}</p>
            </div>
            <div className="shrink-0 rounded-xl bg-cyan-500/15 px-3 py-2 ring-1 ring-cyan-500/30 text-center">
              <p className="text-[11px] font-semibold text-cyan-400">
                max {selected.maxLength} × {selected.maxWidth} m
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={confirm}
            className="w-full bg-gradient-to-r from-brand-500 to-cyan-500 py-3.5 text-sm font-bold tracking-wide text-white transition-all hover:from-brand-400 hover:to-cyan-400 active:scale-[0.99]"
          >
            {selected.name} ile Devam Et →
          </button>
        </div>

      </div>
    </div>
  );
}
