'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { REGIONS, type Region } from '@/lib/regions';

const flagUrl = (c: string) =>
  c === 'eu' ? 'https://flagcdn.com/w80/eu.png'
  : `https://flagcdn.com/w80/${c}.png`;

const REGION_ICONS: Record<string, string> = {
  turkey:      '🇹🇷',
  europe:      '🇪🇺',
  usa:         '🇺🇸',
  middle_east: '🇦🇪',
};

export default function RegionSelector({ onSelect }: { onSelect: (r: Region) => void }) {
  const [selected, setSelected] = useState<Region>(REGIONS[0]);
  const [exiting, setExiting]   = useState(false);

  const confirm = () => {
    setExiting(true);
    setTimeout(() => onSelect(selected), 500);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e8f4f8 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.45 }}
    >
      {/* Subtle background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#0ea5e9 1px, transparent 1px), linear-gradient(90deg, #0ea5e9 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-2xl">

        {/* Header */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Logo area */}
          <div className="mb-5 flex items-center justify-center gap-2">
            <div className="h-10 w-10 overflow-hidden rounded-xl shadow-md">
              <Image src="/carettapool_icon.png" alt="Caretta Pool" width={40} height={40} className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">Caretta Pool</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Teslimat Bölgesi Seçin
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Havuzunuzun teslim edileceği bölgeyi seçin — boyut limitleri otomatik belirlenir.
          </p>
        </motion.div>

        {/* Region cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REGIONS.map((r, i) => {
            const active = selected.id === r.id;
            return (
              <motion.button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition-shadow duration-200 ${
                  active
                    ? 'border-cyan-500 shadow-cyan-100 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Selected indicator */}
                <AnimatePresence>
                  {active && (
                    <motion.div
                      className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-white">
                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Flag */}
                <div className="relative h-8 w-12 overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5">
                  <Image
                    src={flagUrl(r.countryCode)}
                    alt={r.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Name */}
                <div className="text-center">
                  <p className={`text-sm font-semibold leading-tight ${active ? 'text-cyan-700' : 'text-slate-800'}`}>
                    {r.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {r.countryCode.toUpperCase()}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Info bar + CTA */}
        <motion.div
          className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          layout
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              className="flex items-center gap-4 px-5 py-4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22 }}
            >
              {/* Flag large */}
              <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5">
                <Image
                  src={flagUrl(selected.countryCode)}
                  alt={selected.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{selected.name}</p>
                <p className="truncate text-xs text-slate-500">{selected.note}</p>
              </div>

              {/* Limits badge */}
              <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-center ring-1 ring-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Limit</p>
                <p className="text-sm font-bold text-slate-800">
                  {selected.maxLength} × {selected.maxWidth} m
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* CTA button */}
          <motion.button
            type="button"
            onClick={confirm}
            className="relative w-full overflow-hidden bg-slate-900 py-4 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-slate-800 active:bg-slate-950"
            whileTap={{ scale: 0.995 }}
          >
            <motion.span
              key={selected.id}
              className="flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {selected.name} ile Devam Et
              <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current opacity-80">
                <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.53.749.749 0 0 1 .215-.53L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
              </svg>
            </motion.span>
          </motion.button>
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="mt-4 text-center text-xs text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Taşıma koşullarına göre boyut limitleri değişiklik gösterebilir.
        </motion.p>

      </div>
    </motion.div>
  );
}
