'use client';

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

export default function ConfigPanel({ config, onChange }: Props) {
  const set = <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <aside className="card max-h-[80vh] space-y-6 overflow-y-auto p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Tasarım Seçenekleri</h2>
        <p className="text-xs text-slate-500">
          Değişiklikleri 3D ortamda anında görün.
        </p>
      </div>

      <Section title="Boyut">
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
      </Section>

      <Section title="Çerçeve Rengi">
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
                className="h-8 w-full rounded border border-slate-300"
                style={{ background: c.hex }}
              />
              <span className="text-xs font-medium text-slate-700">{c.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Panel Tipi">
        <p className="label">Tümü için varsayılan</p>
        <Toggle
          options={[
            { value: 'glass', label: 'Cam (Şeffaf)' },
            { value: 'closed', label: 'Kapalı Panel' },
          ]}
          value={config.panel}
          onChange={(v) =>
            onChange({ ...config, panel: v as PanelType, panelOverrides: {} })
          }
        />
        <div className="mt-3">
          <p className="label">Bölme sayısı</p>
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as PanelSegments[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set('panelSegments', n)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  config.panelSegments === n
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {n === 1 ? 'Tek' : `${n} bölme`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
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
                  const next: PanelType = current === 'glass' ? 'closed' : 'glass';
                  const overrides = { ...config.panelOverrides };
                  if (next === config.panel) {
                    delete overrides[k]; // back to default → no override
                  } else {
                    overrides[k] = next;
                  }
                  set('panelOverrides', overrides);
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Bölmeyi tıklayarak <span className="font-medium">cam ↔ kapalı</span> arasında geçiş yap.
          </p>
        </div>
      </Section>

      <Section title="Şelale">
        <Toggle
          options={[
            { value: 'on', label: 'Var' },
            { value: 'off', label: 'Yok' },
          ]}
          value={config.waterfall ? 'on' : 'off'}
          onChange={(v) => set('waterfall', v === 'on')}
        />
        <p className="text-xs text-slate-500">
          Paslanmaz çelik kavisli su perdesi (havuzun kısa kenarına yerleşir).
        </p>
      </Section>

      <Section title="Işıklandırma">
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
        <div className="mt-3">
          <p className="label">Renk</p>
          <div className="flex gap-2">
            {(['blue', 'white', 'green', 'purple', 'rgb'] as LightColor[]).map((c) => (
              <button
                key={c}
                type="button"
                disabled={!config.lighting.enabled}
                onClick={() => set('lighting', { ...config.lighting, color: c })}
                className={`h-9 w-9 rounded-full border-2 transition-all ${
                  config.lighting.color === c
                    ? 'border-slate-900 scale-110'
                    : 'border-slate-200'
                } ${!config.lighting.enabled ? 'opacity-40' : ''}`}
                style={{ background: lightCssColor(c) }}
                title={c === 'rgb' ? 'RGB animasyon' : c}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Zemin Altı">
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
      </Section>

      <Section title="İç Kaplama">
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
        <div className="mt-3">
          <p className="label">Özel desen</p>
          <div className="grid grid-cols-5 gap-2">
            {(['texture1', 'texture2', 'texture3', 'texture4', 'texture5'] as CladdingType[]).map(
              (t, i) => {
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
                      style={{ backgroundImage: `url(/textures/${t}.jpeg), url(/textures/${t}.jpg)` }}
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/55 py-0.5 text-center text-[10px] font-medium text-white">
                      {i + 1}
                    </span>
                  </button>
                );
              }
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <code>public/textures/texture1.jpeg</code> gibi dosyaları havuz zeminine uygular.
          </p>
        </div>
      </Section>
    </aside>
  );
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
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
            value === o.value ? 'bg-white shadow font-medium' : 'text-slate-600'
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
              ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
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
    case 'blue': return '#3b82f6';
    case 'white': return '#f8fafc';
    case 'green': return '#22c55e';
    case 'purple': return '#a855f7';
    case 'rgb':
      return 'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #ec4899, #ef4444)';
  }
}
