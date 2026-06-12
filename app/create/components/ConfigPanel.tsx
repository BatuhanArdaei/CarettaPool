'use client';

import { useState } from 'react';
import {
  POOL_SIDES,
  getPanelType,
  panelKey,
  segmentsForSide,
  type CladdingType,
  type FrameColor,
  type GroundType,
  type LightColor,
  type PanelType,
  type PoolConfig,
  type PoolSide,
} from '@/lib/types';
import { useState as useStateR } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatTRY, type PriceBreakdown } from '@/lib/pricing';
import { countPanels } from '@/lib/types';
import type { Region } from '@/lib/regions';

interface Props {
  config: PoolConfig;
  onChange: (next: PoolConfig) => void;
  region: Region;
  // Özet adımı için
  breakdown: PriceBreakdown;
  isDealer: boolean;
  discountRate: number;
  loading: boolean;
  priceError: string | null;
  userId: string;
  userEmail: string;
  fullName: string;
  role: 'customer' | 'dealer' | 'admin';
}

interface StepDef {
  key: 'size' | 'frame' | 'panels' | 'waterfall' | 'lighting' | 'ground' | 'finish' | 'summary';
  title: string;
  short: string;
  tip: string;
}

const STEPS: StepDef[] = [
  {
    key: 'size',
    title: 'Boyut',
    short: 'Boyut',
    tip: 'Havuzun genişlik ve uzunluğunu metre cinsinden belirleyin. Slider\'ları çekerek 3D ortamda anlık güncellemeyi görebilirsiniz.',
  },
  {
    key: 'frame',
    title: 'Çerçeve Rengi',
    short: 'Çerçeve',
    tip: 'Çelik çerçevenin rengini seçin. Antrasit standart sertir; mavi ve beyaz dekoratif renklerdir.',
  },
  {
    key: 'panels',
    title: 'Cam Paneller',
    short: 'Paneller',
    tip: 'Önce tümü için varsayılan tipi (cam veya kapalı) seçin, sonra bölme sayısını belirleyin. Aşağıdaki ızgaradan istediğiniz bölmeyi tıklayarak tek tek değiştirebilirsiniz.',
  },
  {
    key: 'waterfall',
    title: 'Opsiyonlar',
    short: 'Opsiyonlar',
    tip: 'Şelale, yan platform, dış uzatma ve merdiven gibi opsiyonel ekipmanları bu adımdan açıp kapatabilirsiniz.',
  },
  {
    key: 'lighting',
    title: 'Işıklandırma',
    short: 'Işık',
    tip: 'Sualtı LED + havuz çevresi LED şerit. Açıkken ortam gece moduna geçer ve ışık çevreyi aydınlatır. RGB seçeneği renkler arası canlı animasyon yapar.',
  },
  {
    key: 'ground',
    title: 'Zemin Önizleme',
    short: 'Zemin',
    tip: 'Havuz çevresindeki zemin tipini seçin. 3D sahnede anlık önizleyebilirsiniz.',
  },
  {
    key: 'finish',
    title: 'Kaplama',
    short: 'Kaplama',
    tip: 'Havuzun iç ve dış yüzeylerinde kullanılacak kaplama desenini seçin.',
  },
  {
    key: 'summary',
    title: 'Özet & Teklif',
    short: 'Özet',
    tip: 'Seçimlerinizi gözden geçirin. Her şey doğruysa "Teklif Al" butonuna basarak talebinizi iletebilirsiniz.',
  },
];

export default function ConfigPanel({
  config, onChange,
  region,
  breakdown, isDealer, discountRate, loading, priceError,
  userId, userEmail, fullName, role,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [tipOpen, setTipOpen] = useState(true);

  const set = <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) =>
    onChange({ ...config, [key]: value });

  const step = STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <aside className="card flex max-h-[80vh] flex-col">
      {/* Stepper */}
      <div className="border-b border-slate-200 p-3">
        <div className="flex items-stretch justify-between gap-0.5">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStepIdx(i)}
              className="flex flex-1 flex-col items-center gap-1 px-0.5 py-1 transition"
              title={s.title}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                  i === stepIdx
                    ? 'bg-brand-600 text-white shadow'
                    : i < stepIdx
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-center text-[9px] leading-tight ${
                  i === stepIdx
                    ? 'font-semibold text-brand-700'
                    : 'text-slate-500'
                }`}
              >
                {s.short}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step header + tip */}
      <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            <span className="text-brand-600">{stepIdx + 1}.</span> {step.title}
          </h2>
          <button
            type="button"
            onClick={() => setTipOpen(!tipOpen)}
            className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            {tipOpen ? 'Yardımı gizle' : 'Yardım'}
          </button>
        </div>
        {tipOpen && (
          <div className="mt-2 rounded-md bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200/60">
            <span className="font-semibold">İpucu: </span>
            {step.tip}
          </div>
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {step.key === 'size' && <SizeStep config={config} set={set} region={region} />}
        {step.key === 'frame' && <FrameStep config={config} set={set} />}
        {step.key === 'panels' && (
          <PanelsStep config={config} set={set} onChange={onChange} />
        )}
        {step.key === 'waterfall' && (
          <WaterfallStep config={config} set={set} />
        )}
        {step.key === 'lighting' && <LightingStep config={config} set={set} />}
        {step.key === 'ground'   && <GroundStep  config={config} set={set} />}
        {step.key === 'finish'   && <FinishStep  config={config} set={set} />}
        {step.key === 'summary' && (
          <SummaryStep
            config={config}
            breakdown={breakdown}
            isDealer={isDealer}
            discountRate={discountRate}
            loading={loading}
            priceError={priceError}
            userId={userId}
            userEmail={userEmail}
            fullName={fullName}
            role={role}
          />
        )}
      </div>

      {/* Footer nav */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
          disabled={isFirst}
          className="btn-outline px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Önceki
        </button>
        <span className="text-xs font-medium text-slate-500">
          {stepIdx + 1} / {STEPS.length}
        </span>
        <button
          type="button"
          onClick={() =>
            setStepIdx(Math.min(STEPS.length - 1, stepIdx + 1))
          }
          disabled={isLast}
          className="btn-primary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sonraki →
        </button>
      </div>
    </aside>
  );
}

// ============================================================================
// Step content components
// ============================================================================

function SizeStep({
  config,
  set,
  region,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
  region: Region;
}) {
  // From the camera angle, config.length (Z axis) appears as visual WIDTH
  // and config.width (X axis) appears as visual DEPTH/LENGTH.
  // Sliders are mapped accordingly so labels match visual behaviour.
  return (
    <div className="space-y-4">
      {/* Region badge */}
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 ring-1 ring-brand-200">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" opacity=".3"/>
          <path d="M8 2C4.686 2 2 4.686 2 8s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm.5 9h-1V7h1v4zm0-5h-1V5h1v1z"/>
        </svg>
        <span>
          <strong>{region.name}</strong> — {region.note}
        </span>
      </div>

      {/* Genişlik → config.width */}
      <RangeRow
        label="Genişlik"
        value={config.width}
        min={region.minWidth}
        max={region.maxWidth}
        step={0.1}
        unit="m"
        onChange={(v) => set('width', Math.min(v, region.maxWidth))}
      />

      {/* Uzunluk → config.length */}
      <RangeRow
        label="Uzunluk"
        value={config.length}
        min={region.minLength}
        max={region.maxLength}
        step={0.1}
        unit="m"
        onChange={(v) => set('length', Math.min(v, region.maxLength))}
      />

      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        Toplam alan:{' '}
        <span className="font-semibold text-slate-900">
          {(config.width * config.length).toFixed(1)} m²
        </span>
      </div>
    </div>
  );
}

function FrameStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  return (
    <div className="flex gap-2">
      {(
        [
          { value: 'anthracite', label: 'Antrasit', hex: '#3a3f45' },
          { value: 'blue', label: 'Mavi', hex: '#2da6d2' },
          { value: 'white', label: 'Beyaz', hex: '#e5e7eb' },
        ] as { value: FrameColor; label: string; hex: string }[]
      ).map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => set('frameColor', c.value)}
          className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 transition ${
            config.frameColor === c.value
              ? 'border-brand-600 bg-brand-50'
              : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span
            className="h-10 w-full rounded border border-slate-300"
            style={{ background: c.hex }}
          />
          <span className="text-xs font-medium text-slate-700">{c.label}</span>
        </button>
      ))}
    </div>
  );
}

function PanelsStep({
  config,
  set,
  onChange,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
  onChange: (next: PoolConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label">Tümü için varsayılan</p>
        <Toggle
          options={[
            { value: 'glass', label: 'Cam (Şeffaf)' },
            { value: 'closed', label: 'Kapalı Panel' },
          ]}
          value={config.panel}
          onChange={(v) =>
            onChange({
              ...config,
              panel: v as PanelType,
              panelOverrides: {},
            })
          }
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0">Bölmeleri tek tek seç</p>
          {Object.keys(config.panelOverrides).length > 0 && (
            <button
              type="button"
              onClick={() => set('panelOverrides', {})}
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              Sıfırla
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {POOL_SIDES.map((side) => (
            <PanelRow
              key={side}
              side={side}
              config={config}
              onToggle={(idx) => {
                const k = panelKey(side, idx);
                const current = getPanelType(config, side, idx);
                const next: PanelType =
                  current === 'glass' ? 'closed' : 'glass';
                const overrides = { ...config.panelOverrides };
                if (next === config.panel) {
                  delete overrides[k];
                } else {
                  overrides[k] = next;
                }
                set('panelOverrides', overrides);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WaterfallStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Şelale */}
      <div className="space-y-2">
        <p className="label">Şelale</p>
        <Toggle
          options={[
            { value: 'on', label: 'Var' },
            { value: 'off', label: 'Yok' },
          ]}
          value={config.waterfall ? 'on' : 'off'}
          onChange={(v) => set('waterfall', v === 'on')}
        />
        <p className="text-xs text-slate-500">
          Paslanmaz çelik kavisli su perdesi havuzun kısa kenarına yerleşir.
        </p>
      </div>

      {/* Platform dış uzatma */}
      {(
        <div className="space-y-2">
          <p className="label">Dış Uzatma</p>
          <Toggle
            options={[
              { value: 'on', label: 'Var' },
              { value: 'off', label: 'Yok' },
            ]}
            value={config.platformExtension ? 'on' : 'off'}
            onChange={(v) => set('platformExtension', v === 'on')}
          />
          <p className="text-xs text-slate-500">
            Makine odası ötesindeki açık platform şeridi (ayak + korkuluk). Kapalıyken platform yalnızca makine odası genişliğine iner.
          </p>
        </div>
      )}

      {/* İç Merdiven */}
      <div className="space-y-2">
        <p className="label">İç Merdiven</p>
        <Toggle
          options={[
            { value: 'on', label: 'Var' },
            { value: 'off', label: 'Yok' },
          ]}
          value={config.innerLadder ? 'on' : 'off'}
          onChange={(v) => set('innerLadder', v === 'on')}
        />
        <p className="text-xs text-slate-500">
          Havuz içindeki paslanmaz çelik giriş merdiveni.
        </p>
      </div>

      {/* Korkuluklar */}
      <div className="space-y-2">
        <p className="label">Korkuluklar</p>
        <Toggle
          options={[
            { value: 'on', label: 'Var' },
            { value: 'off', label: 'Yok' },
          ]}
          value={config.railings ? 'on' : 'off'}
          onChange={(v) => set('railings', v === 'on')}
        />
        <p className="text-xs text-slate-500">
          Platform üzerindeki güvenlik korkulukları.
        </p>
      </div>

    </div>
  );
}

function LightingStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <Toggle
        options={[
          { value: 'on', label: 'Açık' },
          { value: 'off', label: 'Kapalı' },
        ]}
        value={config.lighting.enabled ? 'on' : 'off'}
        onChange={(v) =>
          set('lighting', { ...config.lighting, enabled: v === 'on' })
        }
      />
      <div>
        <p className="label">Renk</p>
        <div className="flex gap-2">
          {(['blue', 'white', 'green', 'purple', 'rgb'] as LightColor[]).map(
            (c) => (
              <button
                key={c}
                type="button"
                disabled={!config.lighting.enabled}
                onClick={() =>
                  set('lighting', { ...config.lighting, color: c })
                }
                className={`h-9 w-9 rounded-full border-2 transition-all ${
                  config.lighting.color === c
                    ? 'scale-110 border-slate-900'
                    : 'border-slate-200'
                } ${!config.lighting.enabled ? 'opacity-40' : ''}`}
                style={{ background: lightCssColor(c) }}
                title={c === 'rgb' ? 'RGB animasyon' : c}
                aria-label={c}
              />
            )
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Işık açıkken sahne otomatik olarak gece moduna geçer.
        </p>
      </div>
    </div>
  );
}

const CLADDING_TEXTURES: { file: string; name: string }[] = [
  { file: 'BELIZE MIX 60x120.webp',              name: 'Belize Mix' },
  { file: 'BEST CEPPO BONE 60x120.webp',         name: 'Best Ceppo Bone' },
  { file: 'BEST CEPPO CREAM.webp',               name: 'Best Ceppo Cream' },
  { file: 'BEST CEPPO PEARL 60x120.webp',        name: 'Best Ceppo Pearl' },
  { file: 'BEST CEPPO TARMAC 60x120_.webp',      name: 'Best Ceppo Tarmac' },
  { file: 'BEST SILENCE Pearl 60x120.webp',      name: 'Best Silence Pearl' },
  { file: 'Best Silence Whale 60x120.webp',      name: 'Best Silence Whale' },
  { file: 'BEST STONE TARMAC 60x120.webp',       name: 'Best Stone Tarmac' },
  { file: 'FLORIDA TURKUAZ 60X120.webp',         name: 'Florida Turkuaz' },
  { file: 'KARYA MAVi 60x120.webp',              name: 'Karya Mavi' },
  { file: 'MERIDYEN YESIL 60x120.webp',          name: 'Meridyen Yeşil' },
  { file: 'Meridyen Yesil Bookmatch 60x120.webp',name: 'Meridyen Yeşil Bookmatch' },
  { file: 'Oceon Mavi 30x60.webp',               name: 'Oceon Mavi' },
  { file: 'Oceon Turkuaz 30x60.webp',            name: 'Oceon Turkuaz' },
  { file: 'Onice Moon 60x120.webp',              name: 'Onice Moon' },
  { file: 'Oxide Antrasit 60x120.webp',          name: 'Oxide Antrasit' },
  { file: 'Oxide Cobalt 60X120.webp',            name: 'Oxide Cobalt' },
  { file: 'oxide sky 60x120.webp',               name: 'Oxide Sky' },
  { file: 'OXSiDE TURKUAZ  60x120.webp',         name: 'Oxide Turkuaz' },
  { file: 'PARADISE QARYY MAVI_F1.webp',         name: 'Paradise Qaryy Mavi F1' },
  { file: 'PARADISE QARYY MAVI_F2.webp',         name: 'Paradise Qaryy Mavi F2' },
  { file: 'Paradise Amazon 60x120.webp',         name: 'Paradise Amazon' },
  { file: 'Paradise Ametist 60x120.webp',        name: 'Paradise Ametist' },
  { file: 'Paradise Rain Forest 60x120.webp',    name: 'Paradise Rain Forest' },
  { file: 'Paradise Turkuaz 60x120.webp',        name: 'Paradise Turkuaz' },
  { file: 'SALDA MAVI IC 30x60.webp',            name: 'Salda Mavi' },
];

const PAGE = 5;

function GroundStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label">Zemin Tipi</p>
        <SelectGrid
          options={[
            { value: 'gravel',   label: 'Çakıl' },
            { value: 'wood',     label: 'Tahta Deck' },
            { value: 'grass',    label: 'Çimen' },
            { value: 'concrete', label: 'Beton' },
          ]}
          value={config.ground}
          onChange={(v) => set('ground', v as GroundType)}
        />
      </div>
      <p className="text-xs text-slate-500">
        Seçtiğiniz zemin tipi 3D sahnede anlık olarak güncellenir.
      </p>
    </div>
  );
}

function FinishStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  const [visible, setVisible] = useStateR(PAGE);

  return (
    <div className="space-y-5">
      {/* İç/Dış Kaplama */}
      <div>
        <p className="label">İç / Dış Kaplama</p>

        {/* Standart renkler */}
        <div className="mb-2">
          <SelectGrid
            options={[
              { value: 'white',      label: 'Beyaz' },
              { value: 'blue_mosaic',label: 'Mavi Mozaik' },
              { value: 'gray_stone', label: 'Gri Taş' },
              { value: 'turquoise',  label: 'Turkuaz' },
            ]}
            value={['white','blue_mosaic','gray_stone','turquoise'].includes(config.cladding) ? config.cladding : ''}
            onChange={(v) => set('cladding', v as CladdingType)}
          />
        </div>

        {/* Doku galerisi */}
        <div className="grid grid-cols-5 gap-1.5">
          {CLADDING_TEXTURES.slice(0, visible).map((tex) => {
            const val = `/textures/${tex.file}`;
            const selected = config.cladding === val;
            return (
              <button
                key={tex.file}
                type="button"
                onClick={() => set('cladding', val as CladdingType)}
                title={tex.name}
                className={`relative h-16 overflow-hidden rounded-lg border-2 transition-all ${
                  selected
                    ? 'border-cyan-400 ring-2 ring-cyan-200'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={val}
                  alt={tex.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {selected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-cyan-500/25">
                    <span className="text-xl text-white drop-shadow">✓</span>
                  </span>
                )}
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-0.5 py-0.5 text-center text-[9px] font-medium text-white">
                  {tex.name}
                </span>
              </button>
            );
          })}
        </div>

        {visible < CLADDING_TEXTURES.length && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800 transition"
          >
            Daha fazla ({CLADDING_TEXTURES.length - visible} kaplama daha)
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Reusable controls
// ============================================================================

function PanelRow({
  side,
  config,
  onToggle,
}: {
  side: PoolSide;
  config: PoolConfig;
  onToggle: (index: number) => void;
}) {
  const labels: Record<PoolSide, string> = {
    north: 'Kuzey',
    south: 'Güney',
    east: 'Doğu',
    west: 'Batı',
  };
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-medium text-slate-600">
        {labels[side]}
      </span>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: segmentsForSide(side, config) }, (_, i) => {
          const type = getPanelType(config, side, i);
          const isGlass = type === 'glass';
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(i)}
              title={isGlass ? 'Cam — kapalıya çevir' : 'Kapalı — cama çevir'}
              className={`h-9 flex-1 rounded border text-[11px] font-medium transition ${
                isGlass
                  ? 'border-sky-300 bg-sky-100 text-sky-700 hover:bg-sky-200'
                  : 'border-slate-400 bg-slate-700 text-white hover:bg-slate-800'
              }`}
            >
              {isGlass ? 'Cam' : 'Kapalı'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-sm font-medium text-slate-900">
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand-600"
      />
    </div>
  );
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-2 transition ${
            value === o.value ? 'bg-white font-medium shadow' : 'text-slate-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SelectGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg border px-3 py-2 text-sm transition ${
            value === o.value
              ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function lightCssColor(c: LightColor): string {
  switch (c) {
    case 'blue':   return '#3b82f6';
    case 'white':  return '#f8fafc';
    case 'green':  return '#22c55e';
    case 'purple': return '#a855f7';
    case 'rgb':    return 'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #ec4899, #ef4444)';
  }
}

/* ─── Step 7: Özet & Teklif ─────────────────────────────────────── */
function SummaryStep({
  config, breakdown, isDealer, discountRate, loading, priceError,
  userId, userEmail, fullName, role,
}: {
  config: PoolConfig; breakdown: PriceBreakdown; isDealer: boolean; discountRate: number;
  loading: boolean; priceError: string | null; userId: string; userEmail: string;
  fullName: string; role: 'customer' | 'dealer' | 'admin';
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useStateR(false);
  const [saved, setSaved] = useStateR(false);
  const [saveError, setSaveError] = useStateR<string | null>(null);
  const [showPopup, setShowPopup] = useStateR(false);
  const [contact, setContact] = useStateR({ name: '', email: '', phone: '' });

  const isGuest = !userId;

  async function submitRequest(contactInfo?: { name: string; email: string; phone: string }) {
    setSaving(true); setSaveError(null); setSaved(false);
    try {
      await supabase.from('pool_configs').insert({
        user_id: userId || null,
        config: config as unknown as Record<string, unknown>,
        total_price: breakdown.total,
      });
      if (isGuest && contactInfo) {
        await supabase.from('contact_requests').insert({
          name: contactInfo.name, email: contactInfo.email, phone: contactInfo.phone || null,
          message: `Havuz Teklif Talebi — ${config.width.toFixed(1)}×${config.length.toFixed(1)} m, ${formatTRY(breakdown.total)}`,
        });
      }
      setSaved(true); setShowPopup(false); router.refresh();
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Hata'); }
    setSaving(false);
  }

  const panels = countPanels(config);

  const rows: [string, string][] = [
    ['Boyut', `${config.width.toFixed(1)} × ${config.length.toFixed(1)} m`],
    ['Çerçeve', { anthracite: 'Antrasit', blue: 'Mavi', white: 'Beyaz' }[config.frameColor] ?? config.frameColor],
    ['Panel', `${panels.glass} cam, ${panels.closed} kapalı`],
    ['Işıklandırma', config.lighting.enabled ? `Açık — ${config.lighting.color.toUpperCase()}` : 'Kapalı'],
    ['Şelale', config.waterfall ? 'Var' : 'Yok'],
    ['Zemin', { gravel:'Çakıl', wood:'Tahta Deck', grass:'Çimen', concrete:'Beton' }[config.ground] ?? config.ground],
    ['Kaplama', { white:'Beyaz', blue_mosaic:'Mavi Mozaik', gray_stone:'Gri Taş', turquoise:'Turkuaz' }[config.cladding] ?? 'Özel Desen'],
  ];

  return (
    <div className="space-y-4">
      {/* Seçimler */}
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Seçimleriniz</p>
        <ul className="space-y-1.5">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between text-sm">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-900">{v}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Fiyat */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Fiyat Detayı</p>
        {[
          ['Havuz (taban)', breakdown.base],
          breakdown.frame > 0 ? ['Çerçeve', breakdown.frame] : null,
          breakdown.panel > 0 ? ['Cam paneller', breakdown.panel] : null,
          ['Yan platform', breakdown.platform],
          breakdown.ground > 0 ? ['Zemin altı', breakdown.ground] : null,
          breakdown.cladding > 0 ? ['İç kaplama', breakdown.cladding] : null,
          breakdown.lighting > 0 ? ['Işıklandırma', breakdown.lighting] : null,
          breakdown.waterfall > 0 ? ['Şelale', breakdown.waterfall] : null,
        ].filter(Boolean).map(([label, val]) => (
          <div key={label as string} className="flex justify-between text-sm text-slate-600">
            <span>{label as string}</span>
            <span>{formatTRY(val as number)}</span>
          </div>
        ))}
        {isDealer && breakdown.discount > 0 && (
          <div className="flex justify-between text-sm text-emerald-700 pt-1">
            <span>Bayi indirimi (%{discountRate})</span>
            <span>-{formatTRY(breakdown.discount)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 mt-2">
          <span className="text-sm font-semibold text-slate-700">Toplam</span>
          <span className="text-2xl font-bold text-brand-700">
            {loading ? '…' : formatTRY(breakdown.total)}
          </span>
        </div>
        {priceError && <p className="text-xs text-red-600">{priceError}</p>}
      </div>

      <button
        type="button"
        onClick={() => isGuest ? setShowPopup(true) : submitRequest()}
        disabled={saving || loading}
        className="btn-primary w-full py-3 text-base"
      >
        {saving ? 'Gönderiliyor…' : 'Teklif Al'}
      </button>
      {saved && <p className="text-center text-sm text-emerald-700">Talebiniz alındı!</p>}
      {saveError && <p className="text-center text-sm text-red-700">{saveError}</p>}
      {userEmail && <p className="text-center text-xs text-slate-400">{userEmail}</p>}

      {/* Guest popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPopup(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <button onClick={() => setShowPopup(false)} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-900">Teklif Almak İçin</h3>
            <p className="mt-1 text-sm text-slate-500">Ekibimiz en kısa sürede size ulaşacak.</p>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
              <span className="text-sm text-slate-600">{config.width.toFixed(1)} × {config.length.toFixed(1)} m</span>
              <span className="text-lg font-bold text-brand-700">{formatTRY(breakdown.total)}</span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Ad Soyad *</label>
                <input type="text" className="input" value={contact.name} onChange={e => setContact(p => ({...p, name: e.target.value}))} placeholder="Ad Soyad" />
              </div>
              <div>
                <label className="label">E-posta *</label>
                <input type="email" className="input" value={contact.email} onChange={e => setContact(p => ({...p, email: e.target.value}))} placeholder="ornek@mail.com" />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input type="tel" className="input" value={contact.phone} onChange={e => setContact(p => ({...p, phone: e.target.value}))} placeholder="+90 5__ ___ __ __" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { if (!contact.name || !contact.email) return; submitRequest(contact); }}
              disabled={saving || !contact.name || !contact.email}
              className="btn-primary mt-6 w-full py-3 text-base disabled:opacity-50"
            >
              {saving ? 'Gönderiliyor…' : 'Teklif Gönder'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 7: Özet & Teklif ──────────────────────────────────────── */

