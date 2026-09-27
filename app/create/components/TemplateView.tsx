'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { calibrateFromRect, focalFrom35mm, levelCamera, type Vec2 } from '@/lib/pool/calibration';
import type { PoolTemplate, TemplateCalibration, TemplatePlacement, TemplateSun } from '@/lib/pool/templates';
import type { PoolConfig } from '@/lib/types';

const TemplateScene = dynamic(() => import('./TemplateScene'), { ssr: false });

/** Şablon kalibrasyonundan kamerayı çözer (görüntü yüksekliği 1000 birim kabul edilir). */
export function useTemplateSolution(template: PoolTemplate, calibration?: TemplateCalibration) {
  const c = calibration ?? template.calibration;
  const key = JSON.stringify(c);
  return useMemo(() => {
    if (c.mode === 'level') return levelCamera(c, template.aspect);
    const size = { width: 1000 * template.aspect, height: 1000 };
    const pixels = c.points.map(([x, y]) => [x * size.width, y * size.height] as Vec2);
    const focal = c.focal35 ? focalFrom35mm(c.focal35, template.aspect) : undefined;
    return calibrateFromRect(pixels, size, { width: c.width, depth: c.depth }, focal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, template.aspect]);
}

export default function TemplateView({
  template,
  config,
  night = false,
  calibration,
  placement,
  sun,
  showPool = true,
  fit = 'contain',
  alt,
  children,
}: {
  template: PoolTemplate;
  config: PoolConfig;
  /** Gece görseli ve gece ışıkları */
  night?: boolean;
  calibration?: TemplateCalibration;
  placement?: TemplatePlacement;
  sun?: TemplateSun;
  showPool?: boolean;
  /** 'contain': görsel kırpılmadan sığar, boşluğu bulanık kopyası doldurur; 'cover': alanı doldurur */
  fit?: 'contain' | 'cover';
  alt?: string;
  children?: ReactNode;
}) {
  const solution = useTemplateSolution(template, calibration);

  // 'contain': görsel ve 3D sahne, alana sığan görsel dikdörtgenine yerleşir (taşma olmaz)
  const outerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = outerRef.current;
    if (!el || fit !== 'contain') return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  const frame =
    fit === 'contain' && box
      ? box.w / box.h > template.aspect
        ? { width: box.h * template.aspect, height: box.h }
        : { width: box.w, height: box.w / template.aspect }
      : null;

  const images = (blurred: boolean) =>
    [template.day, template.night].map((src) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt={blurred ? '' : alt ?? ''}
        aria-hidden={blurred || undefined}
        data-venue-photo={blurred ? undefined : (src === template.night) === night ? 'active' : 'inactive'}
        draggable={false}
        className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500 ${
          blurred ? 'scale-110 blur-2xl' : ''
        }`}
        style={{
          objectPosition: `${template.focusX * 100}% 50%`,
          opacity: (src === template.night) === night ? (blurred ? 0.7 : 1) : 0,
        }}
      />
    ));

  return (
    <div ref={outerRef} className="absolute inset-0 overflow-hidden bg-slate-800">
      {fit === 'contain' && images(true)}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
        style={frame ?? { width: '100%', height: '100%' }}
      >
        {/* İki görsel de yüklü tutulur; gündüz/gece geçişi anında ve yumuşak olur */}
        {images(false)}
        {solution && showPool && (fit === 'cover' || frame) && (
          <TemplateScene
            template={template}
            solution={solution}
            config={config}
            night={night}
            placement={placement}
            sun={sun}
          />
        )}
      </div>
      {children}
    </div>
  );
}
