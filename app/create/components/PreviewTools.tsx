'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Önizleme alanı için tam ekran ve görsel indirme butonları.
 * - Tam ekran: Fullscreen API; desteklemeyen tarayıcılarda (iPhone Safari) sabit tam sayfa katman.
 * - İndir: "Mekânda Gör"de fotoğraf + 3D sahne birleştirilir; 3D Stüdyo'da sahne olduğu gibi alınır.
 *   (Canvas'lar preserveDrawingBuffer ile oluşturulur, çizim tamponu okunabilir kalır.)
 */
export function usePreviewExpanded(targetRef: RefObject<HTMLElement>) {
  const [cssExpanded, setCssExpanded] = useState(false);
  const [nativeFull, setNativeFull] = useState(false);

  useEffect(() => {
    const onChange = () => setNativeFull(document.fullscreenElement === targetRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [targetRef]);

  useEffect(() => {
    if (!cssExpanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCssExpanded(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cssExpanded]);

  const toggle = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;
    if (nativeFull) return void document.exitFullscreen();
    if (cssExpanded) return setCssExpanded(false);
    if (el.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* yedek: CSS katmanı */
      }
    }
    setCssExpanded(true);
  }, [targetRef, nativeFull, cssExpanded]);

  return { expanded: nativeFull || cssExpanded, cssExpanded, toggle };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadPreview(container: HTMLElement, fileName: string) {
  const canvases = container.querySelectorAll('canvas');
  const scene = canvases[canvases.length - 1];
  if (!scene) return;

  const out = document.createElement('canvas');
  out.width = scene.width;
  out.height = scene.height;
  const ctx = out.getContext('2d')!;

  // Mekânda Gör: 3D sahnenin arkasındaki görünür fotoğraf (sahneyle aynı çerçeve)
  const photo = container.querySelector<HTMLImageElement>('img[data-venue-photo="active"]');
  if (photo) {
    const img = await loadImage(photo.currentSrc || photo.src);
    // Sahne alanı görselin oranında ve object-cover ile çizili: aynı kırpmayı uygula
    const s = Math.max(out.width / img.naturalWidth, out.height / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (out.width - w) / 2, (out.height - h) / 2, w, h);
  }
  ctx.drawImage(scene, 0, 0);

  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function PreviewTools({
  expanded,
  onToggleExpanded,
  onDownload,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  onDownload: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const btn =
    'flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-brand-600 disabled:opacity-50';

  return (
    <div className="absolute right-3 top-12 z-10 flex flex-col gap-2 sm:right-12 sm:top-3 sm:flex-row">
      <button
        type="button"
        className={btn}
        title={t('configurator.download_image')}
        aria-label={t('configurator.download_image')}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDownload();
          } finally {
            setBusy(false);
          }
        }}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3v10m0 0-4-4m4 4 4-4M4 16h12" />
        </svg>
      </button>
      <button
        type="button"
        className={btn}
        title={t(expanded ? 'configurator.exit_fullscreen' : 'configurator.fullscreen')}
        aria-label={t(expanded ? 'configurator.exit_fullscreen' : 'configurator.fullscreen')}
        onClick={onToggleExpanded}
      >
        {expanded ? (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />
          </svg>
        )}
      </button>
    </div>
  );
}
