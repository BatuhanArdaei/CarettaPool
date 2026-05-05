'use client';

import { useScrollAnimate } from '@/hooks/useScrollAnimate';

type Preset = 'fadeUp' | 'fadeIn' | 'slideLeft' | 'slideRight' | 'scaleIn';

interface Props {
  preset?: Preset;
  delay?: number;
  duration?: number;
  /** Pass stagger ms to animate each direct child with a delay */
  stagger?: number;
  className?: string;
  children: React.ReactNode;
}

export default function AnimateOnScroll({
  preset = 'fadeUp',
  delay = 0,
  duration = 700,
  stagger,
  className,
  children,
}: Props) {
  const ref = useScrollAnimate<HTMLDivElement>({
    preset,
    delay,
    duration,
    stagger,
    threshold: 0.12,
  });

  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: stagger ? undefined : 0 }}
    >
      {children}
    </div>
  );
}
