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
import { CLADDING_TEXTURE_URLS, claddingThumbUrl } from '@/lib/claddingTextures';
import { POOL_TEMPLATES, getTemplate } from '@/lib/pool/templates';
import TemplateView from './TemplateView';
import VenueSelector from './VenueSelector';
import PlacementBar, { PlacementButton } from './PlacementBar';
import { NO_ADJUST, clampAdjust, type PlacementAdjust } from './TemplateScene';
import PreviewTools, { downloadPreview, usePreviewExpanded } from './PreviewTools';

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
  const [viewMode, setViewMode] = useState<'studio' | 'place'>('studio');
  // undefined = henüz seçilmedi, null = mekânsız (3D Stüdyo)
  const [venueId, setVenueId] = useState<string | null | undefined>(undefined);
  const venue = getTemplate(venueId);
  // Mekânda Gör: kullanıcının havuzu taşıması/döndürmesi (mekân başına ayrı saklanır)
  const [placing, setPlacing] = useState(false);
  const [adjusts, setAdjusts] = useState<Record<string, PlacementAdjust>>({});
  const adjust = adjusts[venue.id] ?? NO_ADJUST;
  const setAdjust = (a: PlacementAdjust) =>
    setAdjusts((prev) => ({ ...prev, [venue.id]: clampAdjust(a, venue.placement) }));
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const preview = usePreviewExpanded(previewRef);
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
      img.src = claddingThumbUrl(url);
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
    return <RegionSelector onSelect={setRegion} />;
  }

  if (venueId === undefined) {
    return (
      <VenueSelector
        onSelect={(id) => {
          setVenueId(id);
          setViewMode(id ? 'place' : 'studio');
          setModelLoading(true); // trigger loading overlay after venue pick
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-0 py-0 sm:px-3 sm:py-4">
      <div className="flex flex-col lg:gap-4 lg:grid lg:grid-cols-[340px_1fr]">
        {/* 3D scene — top on mobile (45vh), right column on desktop */}
        <div
          id="tour-preview"
          ref={previewRef}
          className={`card relative overflow-hidden ${
            preview.cssExpanded
              ? 'fixed inset-0 z-[100] h-[100dvh] w-screen rounded-none'
              : 'order-1 lg:order-2 h-[35vh] lg:h-[75vh] lg:min-h-[480px]'
          }`}
        >
          {viewMode === 'studio' ? (
            <PoolScene config={config} controlsRef={controlsRef} />
          ) : (
            <TemplateView
              template={venue}
              config={config}
              night={config.lighting.enabled}
              alt={t(venue.nameKey)}
              adjust={adjust}
              onAdjust={placing ? setAdjust : undefined}
            >
              {placing ? (
                <PlacementBar adjust={adjust} onChange={setAdjust} onDone={() => setPlacing(false)} />
              ) : (
              <>
              <PlacementButton onClick={() => setPlacing(true)} />
              {/* Mekân değiştir */}
              <div className="absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg bg-white/85 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm sm:bottom-3 sm:gap-1.5">
                {POOL_TEMPLATES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    title={t(v.nameKey)}
                    aria-label={t(v.nameKey)}
                    onClick={() => setVenueId(v.id)}
                    className={`relative h-6 w-11 overflow-hidden rounded ring-2 transition sm:h-10 sm:w-[72px] sm:rounded-md ${
                      v.id === venue.id ? 'ring-brand-500' : 'ring-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.lighting.enabled ? v.nightThumb : v.dayThumb}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
              </>
              )}
            </TemplateView>
          )}
          {/* Loading overlay — covers only this panel, shown for 3 s after region pick */}
          {modelLoading && (
            <LoadingScreen onDone={() => setModelLoading(false)} />
          )}
          {viewMode === 'studio' && (
            <button
              id="tour-reset"
              type="button"
              onClick={() => controlsRef.current?.reset()}
              className="absolute top-3 left-3 z-10 rounded-md bg-white/90 px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-white max-w-[120px] sm:max-w-none truncate"
            >
              {t('configurator.resetView')}
            </button>
          )}
          <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 rounded-md bg-white/90 p-0.5 text-xs font-medium shadow-sm ring-1 ring-slate-200">
            {(['studio', 'place'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setViewMode(mode);
                  if (mode === 'place' && !venueId) setVenueId(POOL_TEMPLATES[0].id);
                }}
                className={`rounded px-2.5 py-1.5 transition-colors ${
                  viewMode === mode ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t(mode === 'studio' ? 'configurator.viewStudio' : 'configurator.viewPlace')}
              </button>
            ))}
          </div>
          <PreviewTools
            expanded={preview.expanded}
            onToggleExpanded={preview.toggle}
            onDownload={async () => {
              if (!previewRef.current) return;
              const name = viewMode === 'place' ? venue.id : 'studio';
              const stamp = new Date().toISOString().slice(0, 10);
              await downloadPreview(previewRef.current, `carettapool-${name}-${config.length}x${config.width}m-${stamp}.jpg`);
            }}
          />
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
