'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { LANGUAGES, flagUrl } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { SLUG_MAP, localePath, type PageKey } from '@/lib/i18n/routes';

export default function LanguageSwitcher() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => { setMounted(true); }, []);

  // Close on outside click (checks both trigger and portal dropdown)
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target) ?? false;
      const inDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!inTrigger && !inDropdown) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  function handleSelect(newLang: string) {
    setOpen(false);
    const segments = pathname.split('/').filter(Boolean);
    const currentSlug = segments[1];

    let target: string;
    if (!currentSlug) {
      target = `/${newLang}`;
    } else if (currentSlug === 'create' || currentSlug === 'login') {
      target = `/${newLang}/${currentSlug}`;
    } else {
      const pageKey = SLUG_MAP[lang]?.[currentSlug] as PageKey | undefined;
      target = pageKey ? localePath(newLang, pageKey) : `/${newLang}`;
    }

    router.push(target);
  }

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
      className="max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 py-1.5 shadow-2xl"
    >
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => handleSelect(l.code)}
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
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
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
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {mounted && open && createPortal(dropdown, document.body)}
    </>
  );
}
