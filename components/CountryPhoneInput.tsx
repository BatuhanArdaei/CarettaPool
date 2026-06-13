'use client';

import { useState, useRef, useEffect } from 'react';

type Country = { code: string; name: string; dial: string };

const COUNTRIES: Country[] = [
  { code: 'TR', name: 'Türkiye',          dial: '+90'  },
  { code: 'DE', name: 'Almanya',          dial: '+49'  },
  { code: 'GB', name: 'İngiltere',        dial: '+44'  },
  { code: 'US', name: 'ABD',              dial: '+1'   },
  { code: 'FR', name: 'Fransa',           dial: '+33'  },
  { code: 'NL', name: 'Hollanda',         dial: '+31'  },
  { code: 'ES', name: 'İspanya',          dial: '+34'  },
  { code: 'IT', name: 'İtalya',           dial: '+39'  },
  { code: 'PT', name: 'Portekiz',         dial: '+351' },
  { code: 'PL', name: 'Polonya',          dial: '+48'  },
  { code: 'RO', name: 'Romanya',          dial: '+40'  },
  { code: 'NO', name: 'Norveç',           dial: '+47'  },
  { code: 'DK', name: 'Danimarka',        dial: '+45'  },
  { code: 'LT', name: 'Litvanya',         dial: '+370' },
  { code: 'GR', name: 'Yunanistan',       dial: '+30'  },
  { code: 'SA', name: 'Suudi Arabistan',  dial: '+966' },
  { code: 'AE', name: 'Birleşik Arap Em.',dial: '+971' },
  { code: 'QA', name: 'Katar',            dial: '+974' },
  { code: 'KW', name: 'Kuveyt',           dial: '+965' },
  { code: 'EG', name: 'Mısır',            dial: '+20'  },
  { code: 'MA', name: 'Fas',              dial: '+212' },
  { code: 'RU', name: 'Rusya',            dial: '+7'   },
  { code: 'BE', name: 'Belçika',          dial: '+32'  },
  { code: 'AT', name: 'Avusturya',        dial: '+43'  },
  { code: 'CH', name: 'İsviçre',          dial: '+41'  },
  { code: 'SE', name: 'İsveç',            dial: '+46'  },
  { code: 'FI', name: 'Finlandiya',       dial: '+358' },
  { code: 'CY', name: 'Kıbrıs',           dial: '+357' },
  { code: 'BG', name: 'Bulgaristan',      dial: '+359' },
  { code: 'HR', name: 'Hırvatistan',      dial: '+385' },
];

function Flag({ code }: { code: string }) {
  const cc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w20/${cc}.png`}
      srcSet={`https://flagcdn.com/w40/${cc}.png 2x`}
      width={20}
      height={15}
      alt={code}
      className="rounded-[2px] object-cover"
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}

interface Props {
  dialCode: string;
  phone: string;
  onDialChange: (dial: string) => void;
  onPhoneChange: (phone: string) => void;
  placeholder?: string;
}

export default function CountryPhoneInput({
  dialCode,
  phone,
  onDialChange,
  onPhoneChange,
  placeholder = '5__ ___ __ __',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRIES.find((c) => c.dial === dialCode) ?? COUNTRIES[0];

  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().startsWith(search.toLowerCase()),
      )
    : COUNTRIES;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex">
      {/* Country selector button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center gap-1.5 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none"
      >
        <Flag code={selected.code} />
        <span className="tabular-nums">{selected.dial}</span>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Phone number input */}
      <input
        type="tel"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder={placeholder}
        className="input min-w-0 flex-1 rounded-l-none"
        style={{ borderLeft: 0 }}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Search */}
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ülke ara…"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>

          {/* List */}
          <ul className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">Sonuç bulunamadı</li>
            )}
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onDialChange(c.dial);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-slate-50 ${
                    c.code === selected.code
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700'
                  }`}
                >
                  <Flag code={c.code} />
                  <span className="flex-1 text-left">{c.name}</span>
                  <span className="tabular-nums text-slate-400">{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
