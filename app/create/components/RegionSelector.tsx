'use client';

import { useState } from 'react';
import Image from 'next/image';
import { REGIONS, type Region } from '@/lib/regions';

const flagUrl = (c: string) =>
  c === 'eu' ? 'https://flagcdn.com/w80/eu.png'
  : c === 'un' ? 'https://flagcdn.com/w80/un.png'
  : `https://flagcdn.com/w80/${c}.png`;

/* ─── Landmark SVG per region ─────────────────────────── */
function LandmarkIcon({ id, active }: { id: string; active: boolean }) {
  const col = active ? '#22d3ee' : '#64748b';
  const col2 = active ? '#0891b2' : '#475569';

  if (id === 'turkey') return (
    <svg viewBox="0 0 80 60" className="w-full" fill="none">
      {/* Hagia Sophia silhouette */}
      <rect x="10" y="42" width="60" height="10" rx="1" fill={col}/>
      <rect x="18" y="30" width="44" height="14" rx="1" fill={col}/>
      <rect x="24" y="20" width="32" height="12" rx="1" fill={col}/>
      <ellipse cx="40" cy="20" rx="12" ry="6" fill={col2}/>
      <ellipse cx="40" cy="14" rx="7" ry="4" fill={col}/>
      <ellipse cx="40" cy="10" rx="4" ry="3" fill={col2}/>
      <rect x="16" y="18" width="5" height="16" rx="1" fill={col2}/>
      <rect x="59" y="18" width="5" height="16" rx="1" fill={col2}/>
      {/* Minaret */}
      <rect x="5" y="10" width="7" height="32" rx="1" fill={col}/>
      <ellipse cx="8.5" cy="10" rx="3.5" ry="2" fill={col2}/>
      <rect x="6" y="7" width="5" height="4" rx="0.5" fill={col2}/>
      <rect x="68" y="10" width="7" height="32" rx="1" fill={col}/>
      <ellipse cx="71.5" cy="10" rx="3.5" ry="2" fill={col2}/>
      <rect x="69" y="7" width="5" height="4" rx="0.5" fill={col2}/>
    </svg>
  );

  if (id === 'europe') return (
    <svg viewBox="0 0 80 60" className="w-full" fill="none">
      {/* Eiffel Tower silhouette */}
      <polygon points="40,4 52,52 48,52 40,16 32,52 28,52" fill={col}/>
      <polygon points="40,4 46,28 34,28" fill={col2}/>
      <rect x="26" y="26" width="28" height="5" rx="1" fill={col}/>
      <rect x="29" y="40" width="22" height="4" rx="1" fill={col}/>
      <rect x="28" y="52" width="24" height="4" rx="1" fill={col}/>
      <rect x="39" y="0" width="2" height="6" rx="1" fill={col2}/>
    </svg>
  );

  if (id === 'usa') return (
    <svg viewBox="0 0 80 65" className="w-full" fill="none">
      {/* Statue of Liberty silhouette */}
      <rect x="33" y="50" width="14" height="10" rx="1" fill={col}/>
      <rect x="30" y="40" width="20" height="12" rx="2" fill={col}/>
      <rect x="35" y="25" width="10" height="17" rx="1" fill={col}/>
      <ellipse cx="40" cy="23" rx="7" ry="8" fill={col}/>
      <ellipse cx="40" cy="17" rx="5" ry="6" fill={col2}/>
      {/* Crown */}
      <path d="M34 18 L36 10 L40 16 L44 10 L46 18" stroke={col} strokeWidth="1.5" fill={col2}/>
      {/* Torch arm */}
      <rect x="46" y="28" width="9" height="2.5" rx="1" fill={col}/>
      <rect x="53" y="20" width="2.5" height="10" rx="1" fill={col}/>
      <ellipse cx="54" cy="19" rx="2.5" ry="3" fill="#fbbf24"/>
      {/* Base */}
      <rect x="28" y="55" width="24" height="6" rx="1" fill={col2}/>
    </svg>
  );

  if (id === 'middle_east') return (
    <svg viewBox="0 0 80 65" className="w-full" fill="none">
      {/* Burj Khalifa silhouette */}
      <rect x="37" y="2" width="6" height="20" rx="1" fill={col2}/>
      <rect x="34" y="20" width="12" height="12" rx="1" fill={col}/>
      <rect x="31" y="30" width="18" height="10" rx="1" fill={col}/>
      <rect x="28" y="38" width="24" height="8" rx="1" fill={col2}/>
      <rect x="25" y="44" width="30" height="7" rx="1" fill={col}/>
      <rect x="22" y="49" width="36" height="6" rx="1" fill={col2}/>
      <rect x="18" y="53" width="44" height="8" rx="1" fill={col}/>
    </svg>
  );

  // Other — globe
  return (
    <svg viewBox="0 0 80 60" className="w-full" fill="none">
      <circle cx="40" cy="30" r="24" fill={col2} opacity="0.3"/>
      <circle cx="40" cy="30" r="24" stroke={col} strokeWidth="2" fill="none"/>
      <ellipse cx="40" cy="30" rx="12" ry="24" stroke={col} strokeWidth="1.5" fill="none"/>
      <line x1="16" y1="30" x2="64" y2="30" stroke={col} strokeWidth="1.5"/>
      <line x1="20" y1="18" x2="60" y2="18" stroke={col} strokeWidth="1" opacity="0.6"/>
      <line x1="20" y1="42" x2="60" y2="42" stroke={col} strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}

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

                {/* Landmark */}
                <div className="h-14 w-full px-1">
                  <LandmarkIcon id={r.id} active={active} />
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
