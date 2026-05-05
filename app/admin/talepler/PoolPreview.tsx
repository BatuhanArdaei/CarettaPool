'use client';

import dynamic from 'next/dynamic';
import { defaultPoolConfig, type PoolConfig } from '@/lib/types';

const PoolScene = dynamic(
  () => import('@/app/create/components/PoolScene'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        3D yükleniyor…
      </div>
    ),
  }
);

export default function PoolPreview({ config }: { config: Record<string, unknown> }) {
  // Merge saved config with defaults so missing fields don't crash
  const poolConfig: PoolConfig = {
    ...defaultPoolConfig,
    ...(config as Partial<PoolConfig>),
    lighting: {
      ...defaultPoolConfig.lighting,
      ...((config.lighting as object) ?? {}),
    },
    waterfall: Boolean(config.waterfall ?? false),
  };

  return (
    <div className="h-72 w-full overflow-hidden rounded-xl bg-slate-900">
      <PoolScene config={poolConfig} />
    </div>
  );
}
