'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { POOL_TEMPLATES } from '@/lib/pool/templates';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Mekân seçimi: havuzun "Mekânda Gör" görünümünde yerleştirileceği villa.
 * `null` seçimi mekânsız (yalnızca 3D Stüdyo) devam etmek demektir.
 */
export default function VenueSelector({ onSelect }: { onSelect: (venueId: string | null) => void }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(POOL_TEMPLATES[0].id);
  const [exiting, setExiting] = useState(false);

  const confirm = (venueId: string | null) => {
    setExiting(true);
    setTimeout(() => onSelect(venueId), 450);
  };

  const current = POOL_TEMPLATES.find((v) => v.id === selected) ?? POOL_TEMPLATES[0];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e8f4f8 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#0ea5e9 1px, transparent 1px), linear-gradient(90deg, #0ea5e9 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-4xl py-4">
        <motion.div
          className="mb-6 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t('configurator.venue_title')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('configurator.venue_desc')}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {POOL_TEMPLATES.map((venue, i) => {
            const active = venue.id === selected;
            return (
              <motion.button
                key={venue.id}
                type="button"
                onClick={() => setSelected(venue.id)}
                onDoubleClick={() => confirm(venue.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                className={`group relative overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition-shadow duration-200 ${
                  active ? 'border-cyan-500 shadow-md shadow-cyan-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="relative aspect-video w-full overflow-hidden">
                  <Image src={venue.dayThumb} alt={t(venue.nameKey)} fill sizes="(max-width: 640px) 100vw, 440px" className="object-cover" />
                  {/* Üzerine gelince gece görüntüsü */}
                  <Image
                    src={venue.nightThumb}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 440px"
                    className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 shadow"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        <svg viewBox="0 0 12 12" className="h-3.5 w-3.5">
                          <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="px-4 py-3">
                  <p className={`text-sm font-semibold ${active ? 'text-cyan-700' : 'text-slate-800'}`}>{t(venue.nameKey)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t(`${venue.nameKey}_desc`)}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.div
          className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.45 }}
        >
          <button
            type="button"
            onClick={() => confirm(current.id)}
            className="flex w-full items-center justify-center gap-2 bg-slate-900 py-4 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-slate-800 active:bg-slate-950"
          >
            {t('configurator.venue_continue').replace('{name}', t(current.nameKey))}
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current opacity-80">
              <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.53.749.749 0 0 1 .215-.53L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </motion.div>

        <button
          type="button"
          onClick={() => confirm(null)}
          className="mx-auto mt-3 block text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          {t('configurator.venue_skip')}
        </button>
      </div>
    </motion.div>
  );
}
