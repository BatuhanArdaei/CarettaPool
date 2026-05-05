'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Slide {
  image: string;
  alt: string;
}

const SLIDES: Slide[] = [
  { image: '/havuz-gunduz-1.jpg', alt: 'Caretta Pool gündüz' },
  { image: '/havuz-gece-1.jpg', alt: 'Caretta Pool gece' },
  { image: '/havuz-gunduz-2.jpg', alt: 'Caretta Pool bahçe' },
  { image: '/havuz-gece-2.jpg', alt: 'Caretta Pool aydınlatma' },
];

const SLIDE_DURATION = 6500; // ms

export default function HeroSlider() {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  // requestAnimationFrame loop for smooth progress; advances to next slide
  // when the bar fills up.
  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const p = Math.min(((now - start) / SLIDE_DURATION) * 100, 100);
      setProgress(p);
      if (p < 100) {
        raf = requestAnimationFrame(loop);
      } else {
        setIdx((i) => (i + 1) % SLIDES.length);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [idx]);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-slate-900">
      {/* Crossfading background slides */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          aria-hidden={i !== idx}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
            i === idx ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${s.image})` }}
        />
      ))}

      {/* Darker dual-layer overlay for clear text contrast */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-6 text-center text-white">
        <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Yenilikçi Caretta Pools
          <br />
          Lüksün İçine Dalın!
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/90 md:text-lg">
          Alanınızı son teknoloji bir Caretta Pools ile dönüştürmeye hazır
          mısınız? Kendi Caretta Pool&apos;unu oluştur; lüks ve
          sürdürülebilirliğin kusursuz dünyasına adım at.
        </p>
        <Link
          href="/create"
          className="mt-10 inline-flex items-center justify-center rounded-md bg-brand-500 px-8 py-3.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-brand-400"
        >
          Kendiniz Havuzunu Yaratın
        </Link>
      </div>

      {/* Bottom timebar with wave following the progress */}
      <div className="absolute bottom-6 left-0 right-0 z-20">
        {/* Slide counter + clickable dots */}
        <div className="mx-auto mb-3 flex max-w-6xl items-center justify-between px-6 text-xs text-white/80">
          <span className="font-semibold tracking-[0.22em]">
            {String(idx + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Slayt ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx
                    ? 'w-8 bg-white'
                    : 'w-4 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* The actual timebar track */}
        <div className="relative h-1 w-full bg-white/15">
          {/* Filled portion */}
          <div
            className="absolute left-0 top-0 h-full bg-brand-400"
            style={{ width: `${progress}%` }}
          />
          {/* Wave PNG riding the leading edge of the timebar */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wave_svg.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              left: `${progress}%`,
              top: '50%',
              transform: 'translate(-50%, -60%)',
              height: '56px',
              width: 'auto',
              filter:
                'brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(400%) hue-rotate(155deg) drop-shadow(0 0 5px rgba(34,211,238,0.75))',
            }}
          />
        </div>
      </div>
    </section>
  );
}
