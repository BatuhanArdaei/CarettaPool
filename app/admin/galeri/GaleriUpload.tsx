'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { uploadGalleryImage } from './actions';

const CATEGORIES = [
  { value: 'havuz', label: 'Havuz' },
  { value: 'fuar', label: 'Fuar' },
  { value: 'fabrika', label: 'Fabrika' },
];

export default function GaleriUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const fd = new FormData(e.currentTarget);
      await uploadGalleryImage(fd);
      setSuccess(true);
      setPreview(null);
      formRef.current?.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">Görsel Yükle</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* File picker */}
        <div>
          <label className="block cursor-pointer">
            <div className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
              preview ? 'border-brand-400' : 'border-slate-300 hover:border-brand-400'
            }`}>
              {preview ? (
                <div className="relative h-40 w-full">
                  <Image src={preview} alt="Önizleme" fill className="object-contain" />
                </div>
              ) : (
                <>
                  <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="mt-2 text-sm text-slate-500">Tıkla veya sürükle (JPEG / PNG / WebP / GIF, maks 10 MB)</span>
                </>
              )}
            </div>
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFile}
              className="sr-only"
              required
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="g-category">Kategori</label>
            <select id="g-category" name="category" className="input" required>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="g-alt">Alt metin (opsiyonel)</label>
            <input id="g-alt" name="alt" type="text" className="input" placeholder="Fotoğraf açıklaması" />
          </div>
        </div>

        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded bg-green-50 p-3 text-sm text-green-700">Görsel başarıyla yüklendi.</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Yükle'}
        </button>
      </form>
    </div>
  );
}
