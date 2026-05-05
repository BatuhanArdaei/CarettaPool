'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { flagUrl } from '@/lib/i18n';

export const COUNTRY_CODES = [
  { code: 'TR', country: 'tr', dial: '+90',  name: 'Türkiye' },
  { code: 'DE', country: 'de', dial: '+49',  name: 'Deutschland' },
  { code: 'GB', country: 'gb', dial: '+44',  name: 'United Kingdom' },
  { code: 'FR', country: 'fr', dial: '+33',  name: 'France' },
  { code: 'NL', country: 'nl', dial: '+31',  name: 'Netherlands' },
  { code: 'IT', country: 'it', dial: '+39',  name: 'Italia' },
  { code: 'PT', country: 'pt', dial: '+351', name: 'Portugal' },
  { code: 'ES', country: 'es', dial: '+34',  name: 'España' },
  { code: 'RO', country: 'ro', dial: '+40',  name: 'România' },
  { code: 'LT', country: 'lt', dial: '+370', name: 'Lietuva' },
  { code: 'PL', country: 'pl', dial: '+48',  name: 'Polska' },
  { code: 'NO', country: 'no', dial: '+47',  name: 'Norge' },
  { code: 'DK', country: 'dk', dial: '+45',  name: 'Danmark' },
  { code: 'GR', country: 'gr', dial: '+30',  name: 'Ελλάδα' },
  { code: 'SA', country: 'sa', dial: '+966', name: 'السعودية' },
  { code: 'US', country: 'us', dial: '+1',   name: 'USA' },
  { code: 'AU', country: 'au', dial: '+61',  name: 'Australia' },
  { code: 'AT', country: 'at', dial: '+43',  name: 'Österreich' },
  { code: 'BE', country: 'be', dial: '+32',  name: 'België' },
  { code: 'CH', country: 'ch', dial: '+41',  name: 'Schweiz' },
  { code: 'RU', country: 'ru', dial: '+7',   name: 'Россия' },
  { code: 'UA', country: 'ua', dial: '+380', name: 'Україна' },
  { code: 'AE', country: 'ae', dial: '+971', name: 'الإمارات' },
  { code: 'QA', country: 'qa', dial: '+974', name: 'قطر' },
  { code: 'KW', country: 'kw', dial: '+965', name: 'الكويت' },
] as const;

interface Props {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

export default function PhoneInput({ value, onChange, placeholder, className, required, id }: Props) {
  const [country, setCountry] = useState(COUNTRY_CODES[0]);
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleNumberChange(n: string) {
    setNumber(n);
    onChange(n ? `${country.dial} ${n}` : '');
  }

  function handleCountrySelect(c: typeof COUNTRY_CODES[number]) {
    setCountry(c);
    setOpen(false);
    setSearch('');
    onChange(number ? `${c.dial} ${number}` : '');
  }

  const filtered = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className={`relative flex gap-0 ${className ?? ''}`}>
      {/* Country code selector */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex shrink-0 items-center gap-1.5 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100 focus:outline-none"
      >
        <Image src={flagUrl(country.country, 40)} alt={country.name} width={20} height={14} className="rounded-[2px] object-cover" unoptimized />
        <span className="text-xs font-medium text-slate-600">{country.dial}</span>
        <svg className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {/* Number input */}
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={number}
        onChange={e => handleNumberChange(e.target.value.replace(/[^0-9\s\-]/g, ''))}
        placeholder={placeholder ?? '5__ ___ __ __'}
        required={required}
        className="min-w-0 flex-1 rounded-r-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-2">
            <input
              type="text"
              placeholder="Ülke ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCountrySelect(c)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 ${c.code === country.code ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700'}`}
              >
                <Image src={flagUrl(c.country, 40)} alt={c.name} width={24} height={17} className="rounded-[2px] object-cover" unoptimized />
                <span className="flex-1 text-left">{c.name}</span>
                <span className="text-xs text-slate-400">{c.dial}</span>
              </button>
            ))}
            {!filtered.length && <p className="px-4 py-3 text-sm text-slate-400">Sonuç yok</p>}
          </div>
        </div>
      )}
    </div>
  );
}
