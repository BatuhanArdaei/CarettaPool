'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'caretta_bayi_popup_dismissed';

export default function BayiPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show once per session — don't show again after dismiss
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      // Small delay so the page loads first
      const t = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    window.dispatchEvent(new Event('caretta:bayi-dismissed'));
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      aria-modal="true"
      role="dialog"
      aria-label="Bayi girişi"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-200">
        {/* Close */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Kapat"
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900">Bayi misiniz?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Bayi hesabınız varsa giriş yaparak size özel fiyatlandırmayı ve öncelikli
          teklif avantajlarını görebilirsiniz.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/login?redirect=/create"
            onClick={dismiss}
            className="flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
          >
            Bayi Girişi Yap
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50"
          >
            Hayır, misafir olarak devam et
          </button>
        </div>
      </div>
    </div>
  );
}
