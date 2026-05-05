'use client';

import { useEffect, useRef } from 'react';

type AnimationPreset = 'fadeUp' | 'fadeIn' | 'slideLeft' | 'slideRight' | 'scaleIn';

interface Options {
  preset?: AnimationPreset;
  delay?: number;
  duration?: number;
  stagger?: number;
  threshold?: number;
}

const PRESETS: Record<AnimationPreset, object> = {
  fadeUp:    { opacity: [0, 1], translateY: [40, 0] },
  fadeIn:    { opacity: [0, 1] },
  slideLeft: { opacity: [0, 1], translateX: [-60, 0] },
  slideRight:{ opacity: [0, 1], translateX: [60, 0] },
  scaleIn:   { opacity: [0, 1], scale: [0.85, 1] },
};

export function useScrollAnimate<T extends HTMLElement>(
  opts: Options = {}
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let anime: typeof import('animejs').default | null = null;

    const observe = async () => {
      try {
        const mod = await import('animejs');
        anime = mod.default;
      } catch {
        return; // animejs not installed yet
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || !anime) return;

            const targets = opts.stagger
              ? Array.from(el.children)
              : el;

            anime({
              targets,
              ...PRESETS[opts.preset ?? 'fadeUp'],
              duration: opts.duration ?? 700,
              delay: opts.stagger
                ? anime.stagger(opts.stagger, { start: opts.delay ?? 0 })
                : (opts.delay ?? 0),
              easing: 'easeOutCubic',
            });

            observer.disconnect();
          });
        },
        { threshold: opts.threshold ?? 0.15 }
      );

      observer.observe(el);
      return () => observer.disconnect();
    };

    const cleanup = observe();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [opts.preset, opts.delay, opts.duration, opts.stagger, opts.threshold]);

  return ref;
}
