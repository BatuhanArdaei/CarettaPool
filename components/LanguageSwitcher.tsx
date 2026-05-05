'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { LANGUAGES, flagUrl, type LangCode } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500 hover:text-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Image
          src={flagUrl(current.country, 40)}
          alt={current.name}
          width={20}
          height={14}
          className="rounded-[2px] object-cover"
          unoptimized
        />
        <span className="hidden sm:inline">{current.name}</span>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round"
        >
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 py-1.5 shadow-2xl">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 ${
                l.code === lang ? 'bg-slate-800 text-brand-400 font-medium' : 'text-slate-300'
              }`}
            >
              <Image
                src={flagUrl(l.country, 40)}
                alt={l.name}
                width={24}
                height={17}
                className="rounded-[2px] object-cover"
                unoptimized
              />
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
