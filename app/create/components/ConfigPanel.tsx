'use client';

import { useState } from 'react';
import {
  POOL_SIDES,
  getPanelType,
  panelKey,
  type CladdingType,
  type FrameColor,
  type GroundType,
  type LightColor,
  type PanelSegments,
  type PanelType,
  type PoolConfig,
  type PoolSide,
} from '@/lib/types';

interface Props {
  config: PoolConfig;
  onChange: (next: PoolConfig) => void;
}

interface StepDef {
  key: 'size' | 'frame' | 'panels' | 'waterfall' | 'lighting' | 'finish';
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
    title: 'Şelale',
    short: 'Şelale',
    tip: 'Havuzun kısa kenarına paslanmaz çelik kavisli şelale eklemek isterseniz "Var" seçin.',
  },
  {
    key: 'lighting',
    title: 'Işıklandırma',
    short: 'Işık',
    tip: 'Sualtı LED + havuz çevresi LED şerit. Açıkken ortam gece moduna geçer ve ışık çevreyi aydınlatır. RGB seçeneği renkler arası canlı animasyon yapar.',
  },
  {
    key: 'finish',
    title: 'Zemin & Kaplama',
    short: 'Kaplama',
    tip: 'Havuz çevresindeki zemin tipi ve havuz içindeki kaplama desenini seçin. Özel desenler için resimleri public/textures/ klasörüne (texture1.jpeg gibi) koyabilirsiniz.',
  },
];

export default function ConfigPanel({ config, onChange }: Props) {
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
        {step.key === 'size' && <SizeStep config={config} set={set} />}
        {step.key === 'frame' && <FrameStep config={config} set={set} />}
        {step.key === 'panels' && (
          <PanelsStep config={config} set={set} onChange={onChange} />
        )}
        {step.key === 'waterfall' && (
          <WaterfallStep config={config} set={set} />
        )}
        {step.key === 'lighting' && <LightingStep config={config} set={set} />}
        {step.key === 'finish' && <FinishStep config={config} set={set} />}
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
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <RangeRow
        label="Genişlik"
        value={config.width}
        min={2}
        max={10}
        step={0.1}
        unit="m"
        onChange={(v) => set('width', v)}
      />
      <RangeRow
        label="Uzunluk"
        value={config.length}
        min={2}
        max={10}
        step={0.1}
        unit="m"
        onChange={(v) => set('length', v)}
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
        <p className="label">Bölme sayısı</p>
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as PanelSegments[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set('panelSegments', n)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                config.panelSegments === n
                  ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {n === 1 ? 'Tek' : `${n} bölme`}
            </button>
          ))}
        </div>
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
    <div className="space-y-3">
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

function FinishStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="label">Zemin Altı (havuz çevresi)</p>
        <SelectGrid
          options={[
            { value: 'gravel', label: 'Çakıl' },
            { value: 'wood', label: 'Tahta Deck' },
            { value: 'grass', label: 'Çimen' },
            { value: 'concrete', label: 'Beton' },
          ]}
          value={config.ground}
          onChange={(v) => set('ground', v as GroundType)}
        />
      </div>

      <div>
        <p className="label">İç Kaplama</p>
        <SelectGrid
          options={[
            { value: 'white', label: 'Beyaz' },
            { value: 'blue_mosaic', label: 'Mavi Mozaik' },
            { value: 'gray_stone', label: 'Gri Taş' },
            { value: 'turquoise', label: 'Turkuaz' },
          ]}
          value={config.cladding}
          onChange={(v) => set('cladding', v as CladdingType)}
        />
      </div>

      <div>
        <p className="label">Özel desen</p>
        <div className="grid grid-cols-5 gap-2">
          {(
            [
              'texture1',
              'texture2',
              'texture3',
              'texture4',
              'texture5',
            ] as CladdingType[]
          ).map((t, i) => {
            const isSelected = config.cladding === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => set('cladding', t)}
                className={`relative h-14 overflow-hidden rounded-lg border-2 transition ${
                  isSelected
                    ? 'border-brand-600 ring-2 ring-brand-200'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
                title={`Desen ${i + 1}`}
              >
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(/textures/${t}.jpeg), url(/textures/${t}.jpg)`,
                  }}
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 py-0.5 text-center text-[10px] font-medium text-white">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Resimleri{' '}
          <code className="rounded bg-slate-100 px-1">
            public/textures/texture1.jpeg
          </code>{' '}
          gibi yerleştirin.
        </p>
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
        {Array.from({ length: config.panelSegments }, (_, i) => {
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
    case 'blue':
      return '#3b82f6';
    case 'white':
      return '#f8fafc';
    case 'green':
      return '#22c55e';
    case 'purple':
      return '#a855f7';
    case 'rgb':
      return 'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #ec4899, #ef4444)';
  }
}
