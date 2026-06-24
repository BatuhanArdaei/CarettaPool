'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { defaultPoolConfig, type PoolConfig } from '@/lib/types';
import { calculateBasePrice, type PriceBreakdown } from '@/lib/pricing';
import { getRegion, REGIONS, type Region } from '@/lib/regions';
import ConfigPanel from './ConfigPanel';
import RegionSelector from './RegionSelector';
import LoadingScreen from './LoadingScreen';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfigTour from './ConfigTour';
import { CLADDING_TEXTURE_URLS } from '@/lib/claddingTextures';

function PoolSceneLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full items-center justify-center text-slate-500">
      {t('configurator.loading_3d')}
    </div>
  );
}

const PoolScene = dynamic(() => import('./PoolScene'), {
  ssr: false,
  loading: () => <PoolSceneLoading />,
});

interface Props {
  userId: string;
  userEmail: string;
  role: 'customer' | 'dealer' | 'admin';
  fullName: string;
}

export default function ConfiguratorClient({ userId, userEmail, role, fullName }: Props) {
  const { t } = useLanguage();
  const [modelLoading, setModelLoading] = useState(false);
  const [region,       setRegion]       = useState<Region | null>(null);
  const [config, setConfig] = useState<PoolConfig>(defaultPoolConfig);
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown>(() =>
    calculateBasePrice(defaultPoolConfig)
  );
  const [isDealer, setIsDealer] = useState(false);
  const [discountRate, setDiscountRate] = useState(0);
  const [showPrices, setShowPrices] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  /* Sayfa açılır açılmaz tarayıcı HTTP önbelleğine texture'ları yükle.
     Three.js modülünden önce çalışır; sonraki TextureLoader istekleri
     önbellekten anında yanıt alır. */
  useEffect(() => {
    CLADDING_TEXTURE_URLS.forEach(url => {
      const img = new window.Image();
      img.src = url;
    });
  }, []);

  const debounceKey = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setPriceLoading(true);
      setPriceError(null);
      try {
        const res = await fetch('/api/price', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Fiyat alınamadı');
        const data = await res.json();
        setBreakdown(data.breakdown);
        setIsDealer(Boolean(data.isDealer));
        setDiscountRate(Number(data.discountRate ?? 0));
        setShowPrices(data.showPrices !== false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setPriceError((err as Error).message);
      } finally {
        setPriceLoading(false);
      }
    }, 300);
    return () => { controller.abort(); clearTimeout(t); };
  }, [debounceKey, config]);

  /* Show region selector until a region is chosen */
  if (!region) {
    return (
      <RegionSelector
        onSelect={(r) => {
          setRegion(r);
          setModelLoading(true); // trigger loading overlay after region pick
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-0 py-0 sm:px-3 sm:py-4">
      <div className="flex flex-col lg:gap-4 lg:grid lg:grid-cols-[340px_1fr]">
        {/* 3D scene — top on mobile (45vh), right column on desktop */}
        <div id="tour-preview" className="card relative overflow-hidden order-1 lg:order-2 h-[35vh] lg:h-[75vh] lg:min-h-[480px]">
          <PoolScene config={config} controlsRef={controlsRef} />
          {/* Loading overlay — covers only this panel, shown for 3 s after region pick */}
          {modelLoading && (
            <LoadingScreen onDone={() => setModelLoading(false)} />
          )}
          <button
            id="tour-reset"
            type="button"
            onClick={() => controlsRef.current?.reset()}
            className="absolute top-3 left-3 z-10 rounded-md bg-white/90 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-white max-w-[120px] sm:max-w-none truncate"
          >
            {t('configurator.resetView')}
          </button>
          <ConfigTour />
        </div>

        {/* Config panel (steps 1-6) + step 7 Özet */}
        <div id="tour-panel" className="order-2 lg:order-1">
          <ConfigPanel
            config={config}
            onChange={setConfig}
            region={region}
            breakdown={breakdown}
            isDealer={isDealer}
            discountRate={discountRate}
            showPrices={showPrices}
            loading={priceLoading}
            priceError={priceError}
            userId={userId}
            userEmail={userEmail}
            fullName={fullName}
            role={role}
          />
        </div>
      </div>
    </div>
  );
}
