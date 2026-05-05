'use client';

import { useState, useRef } from 'react';
import { uploadCatalog } from './actions';

export const LANGUAGES = [
  { name: 'Türkçe', code: 'tr', flag: '🇹🇷' },
  { name: 'English', code: 'en', flag: '🇬🇧' },
  { name: 'Deutsch', code: 'de', flag: '🇩🇪' },
  { name: 'Español', code: 'es', flag: '🇪🇸' },
  { name: 'Français', code: 'fr', flag: '🇫🇷' },
  { name: 'Italiano', code: 'it', flag: '🇮🇹' },
  { name: 'Nederlands', code: 'nl', flag: '🇳🇱' },
  { name: 'Português', code: 'pt', flag: '🇵🇹' },
  { name: 'Русский', code: 'ru', flag: '🇷🇺' },
  { name: 'العربية', code: 'ar', flag: '🇸🇦' },
  { name: '中文', code: 'zh', flag: '🇨🇳' },
  { name: '日本語', code: 'ja', flag: '🇯🇵' },
  { name: 'Polski', code: 'pl', flag: '🇵🇱' },
  { name: 'Svenska', code: 'sv', flag: '🇸🇪' },
  { name: 'Norsk', code: 'no', flag: '🇳🇴' },
  { name: 'Dansk', code: 'da', flag: '🇩🇰' },
  { name: 'Suomi', code: 'fi', flag: '🇫🇮' },
  { name: 'Ελληνικά', code: 'el', flag: '🇬🇷' },
  { name: 'Čeština', code: 'cs', flag: '🇨🇿' },
  { name: 'Magyar', code: 'hu', flag: '🇭🇺' },
  { name: 'Română', code: 'ro', flag: '🇷🇴' },
  { name: 'Slovenčina', code: 'sk', flag: '🇸🇰' },
  { name: 'Hrvatski', code: 'hr', flag: '🇭🇷' },
  { name: 'Srpski', code: 'sr', flag: '🇷🇸' },
  { name: 'Українська', code: 'uk', flag: '🇺🇦' },
];

export default function CatalogUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[1]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set('language', selectedLang.name);
      fd.set('languageCode', selectedLang.code);
      fd.set('flag', selectedLang.flag);
      await uploadCatalog(fd);
      setSuccess(true);
      setFileName(null);
      formRef.current?.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">Yeni Katalog Ekle</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Language picker */}
        <div>
          <label className="label">Katalog Dilini Seçin</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setSelectedLang(l)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                  selectedLang.code === l.code
                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                {l.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Seçili: <span className="font-medium">{selectedLang.flag} {selectedLang.name}</span>
          </p>
        </div>

        {/* PDF upload */}
        <div>
          <label className="label">PDF Dosyası (sadece .pdf, maks 50 MB)</label>
          <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition ${
            fileName ? 'border-brand-400 bg-brand-50' : 'border-slate-300 hover:border-brand-400'
          }`}>
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-slate-600">
              {fileName ?? 'PDF dosyasını seçin'}
            </span>
            <input
              type="file"
              name="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              required
            />
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Güvenlik: dosya imzası, uzantı ve MIME tipi sunucu tarafında doğrulanır.
          </p>
        </div>

        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded bg-green-50 p-3 text-sm text-green-700">Katalog başarıyla yüklendi.</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Kataloğu Yükle'}
        </button>
      </form>
    </div>
  );
}
