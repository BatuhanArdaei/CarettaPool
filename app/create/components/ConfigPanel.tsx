'use client';

import { useState, useEffect, useRef } from 'react';
import {
  POOL_SIDES,
  getPanelType,
  panelKey,
  sidePanelSegments,
  type CladdingType,
  type FrameColor,
  type GroundType,
  type InstallationType,
  type StairStyle,
  type PoolEntry,
  type LightColor,
  type PanelType,
  type PoolConfig,
  type PoolCoverType,
  type PoolSide,
} from '@/lib/types';
import { useState as useStateR } from 'react';
import { useRouter } from 'next/navigation';
import type { PriceBreakdown } from '@/lib/pricing';
import { formatPrice, type Currency } from '@/lib/regionalPricing';
import { countPanels, extensionSidesOf, isSunken, outdoorLightingOf, poolEntryOf, type OutdoorLighting } from '@/lib/types';
import type { Region } from '@/lib/regions';
import { useLanguage } from '@/contexts/LanguageContext';
import CountryPhoneInput from '@/components/CountryPhoneInput';
import { CLADDING_TEXTURES, claddingThumbUrl } from '@/lib/claddingTextures';
import { POOL_COLORS, isTileCladding } from '@/lib/poolColors';
import { EQUIPMENT } from '@/lib/equipment';

interface Props {
  config: PoolConfig;
  onChange: (next: PoolConfig) => void;
  region: Region;
  breakdown: PriceBreakdown;
  isDealer: boolean;
  discountRate: number;
  showPrices?: boolean;
  /** Fiyatların para birimi (bölgeye göre) */
  currency?: Currency;
  loading: boolean;
  priceError: string | null;
  userId: string;
  userEmail: string;
  fullName: string;
  role: 'customer' | 'dealer' | 'admin';
}

type StepKey = 'size' | 'install' | 'frame' | 'panels' | 'waterfall' | 'lift' | 'lighting' | 'ground' | 'finish' | 'preview' | 'equipment' | 'summary';

export default function ConfigPanel({
  config, onChange,
  region,
  breakdown, isDealer, discountRate, showPrices: showPricesSetting, currency = 'TRY', loading, priceError,
  userId, userEmail, fullName, role,
}: Props) {
  const { t } = useLanguage();
  const [stepIdx, setStepIdx] = useState(0);
  const [tipOpen, setTipOpen] = useState(true);

  // Sıra: kurulum tipi erken (cam/korkuluk/merdiven buna bağlı); opsiyonel özellikler ve
  // ekipmanlar sonda (kullanıcı eklerken fiyatı görür): … ışık, üst kapak ve güverte, ekipmanlar, özet
  const STEPS: { key: StepKey; title: string; short: string; tip: string }[] = [
    { key: 'size',      title: t('configurator.size'),          short: t('configurator.size'),          tip: t('configurator.size_tip') },
    { key: 'install',   title: t('configurator.install_step_title'), short: t('configurator.install_step_short'), tip: t('configurator.install_step_tip') },
    { key: 'frame',     title: t('configurator.frame_title'),   short: t('configurator.frame'),         tip: t('configurator.frame_tip') },
    { key: 'panels',    title: t('configurator.panels_title'),  short: t('configurator.panels_short'),  tip: t('configurator.panels_tip') },
    { key: 'ground',    title: t('configurator.ground_title'),  short: t('configurator.ground_short'),  tip: t('configurator.ground_tip') },
    { key: 'finish',    title: t('configurator.finish_title'),   short: t('configurator.finish_short'),   tip: t('configurator.finish_tip') },
    { key: 'waterfall', title: t('configurator.options_title'), short: t('configurator.options_title'), tip: t('configurator.options_tip') },
    { key: 'preview',   title: t('configurator.preview_title'),  short: t('configurator.preview_short'),  tip: t('configurator.preview_tip') },
    { key: 'lighting',  title: t('configurator.lighting'),      short: t('configurator.lighting_short'),tip: t('configurator.lighting_tip') },
    { key: 'lift',      title: t('configurator.lift_step_title'), short: t('configurator.lift_step_short'), tip: t('configurator.lift_step_tip') },
    { key: 'equipment', title: t('configurator.equipment_title'), short: t('configurator.equipment_short'), tip: t('configurator.equipment_tip') },
    { key: 'summary',   title: t('configurator.summary_title'), short: t('configurator.summary_short'),  tip: t('configurator.summary_tip') },
  ];

  const set = <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) =>
    onChange({ ...config, [key]: value });

  const step = STEPS[stepIdx];
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [stepIdx]);
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <aside className="card flex h-[55vh] flex-col overflow-hidden lg:h-[75vh] lg:min-h-[480px]">
      {/* Sabit yükseklik (önizleme alanıyla aynı): üst bar ve alt butonlar sabit, yalnızca içerik kayar */}
      {/* Stepper */}
      <div id="tour-stepper" className="shrink-0 border-b border-slate-200 px-2 sm:px-4 py-2 sm:py-3.5">
        <div className="relative flex items-center justify-between">
          {/* Connecting track */}
          <div className="pointer-events-none absolute inset-x-[14px] top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
          {/* Progress fill */}
          <div
            className="pointer-events-none absolute left-[14px] top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-500 transition-all duration-300 ease-out"
            style={{ width: `calc((100% - 28px) * ${STEPS.length > 1 ? stepIdx / (STEPS.length - 1) : 0})` }}
          />
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStepIdx(i)}
                title={s.title}
                aria-label={s.title}
                aria-current={active ? 'step' : undefined}
                className="group relative z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center focus:outline-none"
              >
                <span
                  className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                    active
                      ? 'scale-110 bg-brand-600 text-white shadow ring-4 ring-brand-100'
                      : done
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-slate-400 ring-1 ring-inset ring-slate-300 group-hover:text-brand-500 group-hover:ring-brand-400'
                  }`}
                >
                  {done ? (
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M5 10.5l3.5 3.5L15 6.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step header + tip */}
      <div className="shrink-0 border-b border-slate-100 px-3 sm:px-4 pb-2 sm:pb-3 pt-2 sm:pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            <span className="text-brand-600">{stepIdx + 1}.</span> {step.title}
          </h2>
          <button
            type="button"
            onClick={() => setTipOpen(!tipOpen)}
            className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            {tipOpen ? t('configurator.hideHelp') : t('configurator.help')}
          </button>
        </div>
        {tipOpen && (
          <div className="mt-2 rounded-md bg-amber-50 p-2.5 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200/60">
            <span className="font-semibold">{t('configurator.tip_prefix')}</span>
            {step.tip}
          </div>
        )}
      </div>

      {/* Step content */}
      <div id="tour-content" ref={contentRef} className="min-h-0 flex-1 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {step.key === 'size'      && <SizeStep config={config} set={set} region={region} />}
        {step.key === 'frame'     && <FrameStep config={config} set={set} />}
        {step.key === 'panels'    && <PanelsStep config={config} set={set} onChange={onChange} />}
        {step.key === 'waterfall' && <WaterfallStep config={config} set={set} />}
        {step.key === 'lift'      && <LiftDeckStep config={config} set={set} />}
        {step.key === 'lighting'  && <LightingStep config={config} set={set} />}
        {step.key === 'install'   && <InstallStep config={config} set={set} onChange={onChange} />}
        {step.key === 'ground'    && <GroundStep config={config} set={set} />}
        {step.key === 'equipment' && <EquipmentStep config={config} set={set} />}
        {step.key === 'finish'    && <FinishStep config={config} set={set} />}
        {step.key === 'preview'   && <PreviewStep config={config} set={set} />}
        {step.key === 'summary'   && (
          <SummaryStep
            config={config}
            breakdown={breakdown}
            isDealer={isDealer}
            discountRate={discountRate}
            showPrices={showPricesSetting ?? true}
            currency={currency}
            region={region.id}
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
      <div id="tour-nav" className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 p-2 sm:p-3">
        <button
          type="button"
          onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
          disabled={isFirst}
          className="btn-outline px-4 py-2.5 text-sm min-h-[44px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('configurator.prev')}
        </button>
        <span className="text-xs font-medium text-slate-500">
          {stepIdx + 1} / {STEPS.length}
        </span>
        <button
          type="button"
          onClick={() => setStepIdx(Math.min(STEPS.length - 1, stepIdx + 1))}
          disabled={isLast}
          className="btn-primary px-4 py-2.5 text-sm min-h-[44px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('configurator.next')}
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
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 ring-1 ring-brand-200">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" opacity=".3"/>
          <path d="M8 2C4.686 2 2 4.686 2 8s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm.5 9h-1V7h1v4zm0-5h-1V5h1v1z"/>
        </svg>
        <span>
          <strong>{region.name}</strong> — {region.note}
        </span>
      </div>

      <RangeRow
        label={t('configurator.width_label')}
        value={config.length}
        min={region.minWidth}
        max={region.maxWidth}
        step={0.1}
        unit="m"
        onChange={(v) => set('length', Math.min(v, region.maxWidth))}
      />

      <RangeRow
        label={t('configurator.length_label')}
        value={config.width}
        min={region.minLength}
        max={region.maxLength}
        step={0.1}
        unit="m"
        onChange={(v) => set('width', Math.min(v, region.maxLength))}
      />

      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        {t('configurator.total_area')}:{' '}
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
  const { t } = useLanguage();
  const colors: { value: FrameColor; key: string; hex: string }[] = [
    { value: 'anthracite', key: 'configurator.anthracite', hex: '#3a3f45' },
    { value: 'blue',       key: 'configurator.blue_color', hex: '#2da6d2' },
    { value: 'white',      key: 'configurator.white_color', hex: '#e5e7eb' },
  ];
  return (
    <div className="flex gap-2">
      {colors.map((c) => (
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
          <span className="h-10 w-full rounded border border-slate-300" style={{ background: c.hex }} />
          <span className="text-xs font-medium text-slate-700">{t(c.key)}</span>
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
  const { t } = useLanguage();
  const locked = isSunken(config);
  return (
    <div className="space-y-4">
      {locked && <SunkenNotice text={t('configurator.sunken_panels')} />}
      <div>
        <p className="label">{t('configurator.all_default')}</p>
        <Toggle
          disabled={locked}
          options={[
            { value: 'glass',  label: t('configurator.glass_panel') },
            { value: 'closed', label: t('configurator.closed_panel') },
          ]}
          value={config.panel}
          onChange={(v) =>
            onChange({ ...config, panel: v as PanelType, panelOverrides: {} })
          }
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0">{t('configurator.select_individual')}</p>
          {Object.keys(config.panelOverrides).length > 0 && (
            <button
              type="button"
              onClick={() => set('panelOverrides', {})}
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              {t('configurator.reset_btn')}
            </button>
          )}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="flex h-4 w-5 items-center justify-center rounded-sm border border-sky-300 bg-sky-100 text-sky-600"><PanelIcon glass /></span>
            {t('configurator.glass_btn')}
          </span>
          <span className="flex items-center gap-1">
            <span className="flex h-4 w-5 items-center justify-center rounded-sm border border-slate-400 bg-slate-700 text-slate-300"><PanelIcon glass={false} /></span>
            {t('configurator.closed')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-4 w-5 rounded-sm border border-dashed border-slate-400" />
            {t('configurator.panel_cut_legend')}
          </span>
        </div>
        <div className="space-y-2">
          {POOL_SIDES.map((side) => (
            <PanelRow
              key={side}
              side={side}
              config={config}
              locked={locked}
              onToggle={(idx) => {
                if (side === 'east') return;
                const k = panelKey(side, idx);
                const current = getPanelType(config, side, idx);
                const next: PanelType = current === 'glass' ? 'closed' : 'glass';
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
  const { t } = useLanguage();
  const onLabel  = t('configurator.yes');
  const offLabel = t('configurator.none');

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="label">{t('configurator.waterfall')}</p>
        <Toggle
          options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
          value={config.waterfall && !config.liftDeck ? 'on' : 'off'}
          onChange={(v) => set('waterfall', v === 'on')}
          disabled={config.liftDeck}
        />
        <p className="text-sm text-slate-500">
          {config.liftDeck ? t('configurator.waterfall_blocked_lift') : t('configurator.waterfall_note')}
        </p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.ext_label')}</p>
        <Toggle
          options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
          value={config.platformExtension ? 'on' : 'off'}
          onChange={(v) => set('platformExtension', v === 'on')}
        />
        <p className="text-sm text-slate-500">{t('configurator.ext_note')}</p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.ext_sides_label')}</p>
        <div className="grid grid-cols-3 gap-2">
          {POOL_SIDES.filter((s) => s !== config.platformDirection).map((side) => {
            const active = extensionSidesOf(config).includes(side);
            return (
              <button
                key={side}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const cur = extensionSidesOf(config);
                  set('extensionSides', active ? cur.filter((x) => x !== side) : [...cur, side]);
                }}
                className={`rounded-lg border px-3 py-2 text-sm min-h-[44px] transition ${
                  active
                    ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(`configurator.${side}`)}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-slate-500">{t('configurator.ext_sides_note')}</p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.entry_label')}</p>
        <SelectGrid
          options={[
            { value: 'small_stairs', label: t('configurator.entry_small') },
            { value: 'wide_stairs',  label: t('configurator.entry_wide') },
            { value: 'bench',        label: t('configurator.entry_bench') },
            { value: 'none',         label: t('configurator.none') },
          ]}
          value={poolEntryOf(config)}
          onChange={(v) => set('poolEntry', v as PoolEntry)}
        />
        <p className="text-sm text-slate-500">{t('configurator.entry_note')}</p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.stair_style_label')}</p>
        <Toggle
          options={[
            { value: 'none',  label: t('configurator.none') },
            { value: 'open',  label: t('configurator.stair_open') },
            { value: 'block', label: t('configurator.stair_block') },
          ]}
          value={config.stairStyle ?? 'open'}
          onChange={(v) => set('stairStyle', v as StairStyle)}
          disabled={isSunken(config)}
        />
        <p className="text-sm text-slate-500">
          {isSunken(config) ? t('configurator.sunken_unavailable') : t('configurator.stair_style_note')}
        </p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.railings_label')}</p>
        <Toggle
          options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
          value={config.railings && !isSunken(config) ? 'on' : 'off'}
          onChange={(v) => set('railings', v === 'on')}
          disabled={isSunken(config)}
        />
        <p className="text-sm text-slate-500">
          {isSunken(config) ? t('configurator.sunken_unavailable') : t('configurator.railings_note')}
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
  const { t } = useLanguage();
  const disabled = !config.lighting.enabled;
  // Yalnızca beyaz ve RGB (eski kayıtlardaki diğer renkler sahnede aynen gösterilir)
  const ALL_COLORS: LightColor[] = ['white', 'rgb'];

  const outdoor = outdoorLightingOf(config);
  const setOutdoor = (key: keyof OutdoorLighting, on: boolean) =>
    set('outdoorLighting', { ...outdoor, [key]: on });
  const onOff = [
    { value: 'on' as const,  label: t('configurator.open') },
    { value: 'off' as const, label: t('configurator.closed') },
  ];
  const OUTDOOR: { key: keyof OutdoorLighting; label: string; note: string }[] = [
    { key: 'strip',  label: t('configurator.light_strip_label'), note: t('configurator.light_strip_note') },
  ];

  return (
    <div className="space-y-6">
      {/* İç aydınlatma: havuz içi RGB */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t('configurator.lighting_inner_label')}</h3>
        <div className="space-y-1.5">
          <OptionalBadge />
          <Toggle
            options={onOff}
            value={config.lighting.enabled ? 'on' : 'off'}
            onChange={(v) => set('lighting', { ...config.lighting, enabled: v === 'on' })}
          />
        </div>

        <div>
          <p className="label">{t('configurator.color_label')}</p>
          <div className="flex flex-wrap gap-2">
            {ALL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => set('lighting', { ...config.lighting, color: c })}
                className={`h-9 w-9 rounded-full border border-white shadow-sm transition-all duration-200 ${
                  config.lighting.color === c
                    ? 'scale-110 ring-2 ring-brand-600 ring-offset-2'
                    : 'ring-1 ring-slate-200 hover:scale-105 hover:ring-brand-400'
                } ${disabled ? 'opacity-40' : ''}`}
                style={{ background: lightCssColor(c) }}
                title={lightColorName(c)}
                aria-label={lightColorName(c)}
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">{t('configurator.lighting_inner_note')}</p>
      </section>

      {/* Dış aydınlatma: her seçenek ayrı */}
      <section className="space-y-4 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('configurator.lighting_outer_label')}</h3>
        {OUTDOOR.map((o) => (
          <div key={o.key} className="space-y-1.5">
            <p className="label">{o.label}</p>
            <OptionalBadge />
            <Toggle
              options={onOff}
              value={outdoor[o.key] ? 'on' : 'off'}
              onChange={(v) => setOutdoor(o.key, v === 'on')}
            />
            <p className="text-sm text-slate-500">{o.note}</p>
          </div>
        ))}
      </section>

      <p className="text-sm text-slate-500">{t('configurator.lighting_note')}</p>
    </div>
  );
}

/** Açık/kapalı seçiminin üstündeki "OPSİYONEL" etiketi */
function OptionalBadge() {
  const { t } = useLanguage();
  return (
    <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
      {t('configurator.optional_badge')}
    </span>
  );
}



/** Teknik ekipmanlar: 3D'de görünmez, seçilip fiyatlanır */
function EquipmentStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  const { t } = useLanguage();
  const eq = config.equipment ?? {};
  return (
    <div className="space-y-2">
      {EQUIPMENT.map((e) => {
        const on = Boolean(eq[e.id]);
        return (
          <button
            key={e.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => set('equipment', { ...eq, [e.id]: !on })}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
              on ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 bg-white'
              }`}
              aria-hidden
            >
              {on && (
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10.5l3.5 3.5L15 6.5" />
                </svg>
              )}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${on ? 'text-brand-700' : 'text-slate-800'}`}>{t(e.labelKey)}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{t(e.noteKey)}</span>
            </span>
          </button>
        );
      })}
      <p className="pt-1 text-xs text-slate-500">{t('configurator.equipment_note')}</p>
    </div>
  );
}

/** Tam gömülü kurulumda kaldırılan seçimler için bilgi kutusu */
function SunkenNotice({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.75 4.5h1.5v5h-1.5v-5Zm0 6.5h1.5v1.5h-1.5V13Z" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

function InstallStep({
  config,
  set,
  onChange,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
  onChange: (next: PoolConfig) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <div>
        <p className="label">{t('configurator.installation_label')}</p>
        <SelectGrid
          options={[
            { value: 'ground',  label: t('configurator.install_ground') },
            { value: 'partial', label: t('configurator.install_partial') },
            { value: 'sunken',  label: t('configurator.install_sunken') },
          ]}
          value={config.installation ?? 'ground'}
          onChange={(v) =>
            v === 'sunken'
              ? // Tam gömülü: korkuluk ve cam paneller kaldırılır (dış merdiven zaten çizilmez)
                onChange({ ...config, installation: 'sunken', railings: false, panel: 'closed', panelOverrides: {} })
              : set('installation', v as InstallationType)
          }
        />
        <p className="mt-2 text-sm text-slate-500">{t('configurator.install_note')}</p>
        {isSunken(config) && (
          <div className="mt-3">
            <SunkenNotice text={t('configurator.sunken_notice')} />
          </div>
        )}
      </div>
    </div>
  );
}

function GroundStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <div>
        <p className="label">{t('configurator.ground_type')}</p>
        <SelectGrid
          options={[
            { value: 'gravel',   label: t('configurator.gravel') },
            { value: 'wood',     label: t('configurator.wood_deck') },
            { value: 'grass',    label: t('configurator.grass') },
            { value: 'concrete', label: t('configurator.concrete') },
          ]}
          value={config.ground}
          onChange={(v) => set('ground', v as GroundType)}
        />
      </div>
      <p className="text-sm text-slate-500">{t('configurator.ground_note')}</p>
    </div>
  );
}

const MOBILE_INIT = 6; // İlk yüklenen texture sayısı (mobil)

type FinishMode = 'color' | 'tile';

function FinishStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  const { t } = useLanguage();
  const mode: FinishMode = isTileCladding(config.cladding) ? 'tile' : 'color';
  // Mod değişince her moddaki son seçim geri gelsin
  const [lastColor, setLastColor] = useStateR<CladdingType>(mode === 'color' ? config.cladding : 'white');
  const [lastTile, setLastTile] = useStateR<CladdingType>(
    mode === 'tile' ? config.cladding : (`/textures/${CLADDING_TEXTURES[0].file}` as CladdingType),
  );
  const pick = (v: CladdingType) => {
    if (isTileCladding(v)) setLastTile(v);
    else setLastColor(v);
    set('cladding', v);
  };

  // Mobil: 6'dan başla, +1 ile yükle. Masaüstü: hepsini göster.
  const [visible, setVisible] = useStateR(MOBILE_INIT);
  useEffect(() => {
    if (window.innerWidth >= 768) setVisible(CLADDING_TEXTURES.length);
  }, []);
  const remaining = CLADDING_TEXTURES.length - visible;

  return (
    <div className="space-y-3">
      <Toggle
        options={[
          { value: 'color', label: t('configurator.finish_mode_color') },
          { value: 'tile',  label: t('configurator.finish_mode_tile') },
        ]}
        value={mode}
        onChange={(v) => set('cladding', v === 'tile' ? lastTile : lastColor)}
      />
      <p className="text-sm text-slate-500">
        {mode === 'color' ? t('configurator.finish_color_note') : t('configurator.finish_tile_note')}
      </p>

      {mode === 'color' ? (
        /* Renk paleti */
        <div className="grid grid-cols-3 gap-2">
          {POOL_COLORS.map((c) => {
            const selected = config.cladding === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => pick(c.value)}
                className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition ${
                  selected ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className="h-7 w-7 shrink-0 rounded-md ring-1 ring-inset ring-black/10"
                  style={{ background: c.hex }}
                  aria-hidden
                />
                <span className={`min-w-0 text-xs leading-tight ${selected ? 'font-medium text-brand-700' : 'text-slate-600'}`}>
                  {t(c.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Döşeme (seramik doku) ızgarası — 6 sütun, yalnızca visible kadar render edilir */
        <div className="grid grid-cols-6 gap-1">
          {CLADDING_TEXTURES.slice(0, visible).map((tex) => {
            const val = `/textures/${tex.file}` as CladdingType;
            const selected = config.cladding === val;
            return (
              <button
                key={tex.file}
                type="button"
                onClick={() => pick(val)}
                title={tex.name}
                className={`relative h-10 overflow-hidden rounded-md border-2 transition-all ${
                  selected ? 'border-cyan-400 ring-1 ring-cyan-200' : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={claddingThumbUrl(val)}
                  alt={tex.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
                {selected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-cyan-500/30">
                    <span className="text-sm text-white drop-shadow">✓</span>
                  </span>
                )}
              </button>
            );
          })}

          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisible((v) => Math.min(v + 1, CLADDING_TEXTURES.length))}
              className="relative flex h-10 items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:bg-slate-100"
              title={`${remaining} kaplama daha`}
            >
              +1
            </button>
          )}
        </div>
      )}
      {mode === 'tile' && (
        <p className="text-xs text-slate-500">
          {CLADDING_TEXTURES.find((x) => `/textures/${x.file}` === config.cladding)?.name}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Reusable controls
// ============================================================================

/** Cam (açık, pencere çizgili) ya da kapalı panel (dolu) simgesi */
function PanelIcon({ glass }: { glass: boolean }) {
  return glass ? (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M5 11l6-6M8 12l4-4" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function PanelRow({
  side,
  config,
  onToggle,
  locked = false,
}: {
  side: PoolSide;
  config: PoolConfig;
  onToggle: (index: number) => void;
  /** Tam gömülü kurulumda paneller değiştirilemez */
  locked?: boolean;
}) {
  const { t, lang } = useLanguage();
  const sideLabel: Record<PoolSide, string> = {
    north: t('configurator.north'),
    south: t('configurator.south'),
    east:  t('configurator.east'),
    west:  t('configurator.west'),
  };
  const m = (v: number) => v.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const segs = sidePanelSegments(side, config);
  const isCut = (len: number) => Math.abs(len - 2.4) > 0.001;
  const full = segs.filter((len) => !isCut(len)).length;
  const cut = segs.find(isCut);
  const summary = [
    full > 0 ? `${full} × ${m(2.4)} m` : null,
    cut !== undefined ? `${m(cut)} m ${t('configurator.panel_cut')}` : null,
  ].filter(Boolean).join(' + ');

  return (
    <div className="flex items-start gap-2">
      <span className="w-12 shrink-0 pt-2.5 text-xs font-medium text-slate-600">
        {sideLabel[side]}
      </span>
      <div className="min-w-0 flex-1">
        {/* Butonlar camın gerçek genişliğiyle orantılı; içinde yalnızca simge (yazı taşmaz) */}
        <div className="flex gap-1">
          {segs.map((len, i) => {
            const isEast = side === 'east';
            const type = isEast ? 'closed' : getPanelType(config, side, i);
            const isGlass = type === 'glass';
            const label = `${isGlass ? t('configurator.glass_btn') : t('configurator.closed')} · ${m(len)} m${isCut(len) ? ` (${t('configurator.panel_cut')})` : ''}`;
            return (
              <button
                key={i}
                type="button"
                onClick={() => !isEast && !locked && onToggle(i)}
                disabled={isEast || locked}
                title={label}
                aria-label={label}
                style={{ flexGrow: len, flexBasis: 0 }}
                className={`relative flex h-10 min-w-[1.25rem] items-center justify-center rounded border transition ${
                  isGlass
                    ? 'border-sky-300 bg-sky-100 text-sky-600 hover:bg-sky-200'
                    : isEast
                    ? 'cursor-not-allowed border-slate-400 bg-slate-700 text-slate-300 opacity-60'
                    : 'border-slate-400 bg-slate-700 text-slate-300 hover:bg-slate-800'
                } ${isCut(len) ? 'border-dashed' : ''}`}
              >
                <PanelIcon glass={isGlass} />
              </button>
            );
          })}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">{summary}</p>
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
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex rounded-lg bg-slate-100 p-1 text-sm ${disabled ? 'opacity-40' : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-2 min-h-[44px] transition-all duration-200 ${
            value === o.value
              ? 'bg-white font-semibold text-brand-700 shadow-sm ring-1 ring-slate-200/70'
              : 'text-slate-500 hover:text-slate-700'
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
          className={`rounded-lg border px-3 py-2 text-sm min-h-[44px] transition ${
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
    case 'blue':        return '#3b82f6';
    case 'white':       return '#f8fafc';
    case 'warm_white':  return '#fde68a';
    case 'green':       return '#22c55e';
    case 'cyan':        return '#06b6d4';
    case 'turquoise':   return '#14b8a6';
    case 'red':         return '#ef4444';
    case 'orange':      return '#f97316';
    case 'pink':        return '#ec4899';
    case 'purple':      return '#a855f7';
    case 'rgb':         return 'conic-gradient(from 0deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #ec4899, #ef4444)';
    case 'blue_purple': return 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)';
  }
}

function lightColorName(c: LightColor): string {
  const names: Record<LightColor, string> = {
    blue: 'Mavi', white: 'Beyaz', warm_white: 'Sıcak Beyaz',
    green: 'Yeşil', cyan: 'Açık Mavi', turquoise: 'Turkuaz',
    red: 'Kırmızı', orange: 'Turuncu', pink: 'Pembe',
    purple: 'Mor', rgb: 'Gökkuşağı', blue_purple: 'Mavi-Mor',
  };
  return names[c] ?? c;
}

/* ─── Preview ─────────────────────────────────────────────────────── */
function PreviewStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <p className="label">{t('configurator.water_label')}</p>
      <Toggle
        options={[
          { value: 'on',  label: t('configurator.water_on') },
          { value: 'off', label: t('configurator.water_off') },
        ]}
        value={config.showWater ? 'on' : 'off'}
        onChange={(v) => set('showWater', v === 'on')}
      />

    </div>
  );
}

/* ─── Üst kapak & hareketli güverte (birbirini dışlar) ──────────────── */
function LiftDeckStep({
  config,
  set,
}: {
  config: PoolConfig;
  set: <K extends keyof PoolConfig>(key: K, value: PoolConfig[K]) => void;
}) {
  const { t } = useLanguage();
  const onLabel  = t('configurator.yes');
  const offLabel = t('configurator.none');
  // Havuz kapağıyla birlikte olamaz
  const blocked = config.poolCover && !config.liftDeck;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="label">{t('configurator.cover_label')}</p>
        <Toggle
          options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
          value={config.poolCover && !config.liftDeck ? 'on' : 'off'}
          onChange={(v) => set('poolCover', v === 'on')}
          disabled={config.liftDeck}
        />
        {config.poolCover && !config.liftDeck && (
          <Toggle
            options={[
              { value: 'automatic', label: t('configurator.cover_auto') },
              { value: 'manual', label: t('configurator.cover_manual') },
            ]}
            value={config.poolCoverType}
            onChange={(v) => set('poolCoverType', v as PoolCoverType)}
          />
        )}
        <p className="text-sm text-slate-500">
          {config.liftDeck ? t('configurator.cover_blocked_lift') : t('configurator.cover_note')}
        </p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.cover_state_label')}</p>
        <Toggle
          options={[
            { value: 'closed', label: t('configurator.cover_closed') },
            { value: 'open',   label: t('configurator.cover_open') },
          ]}
          value={config.poolCoverClosed ? 'closed' : 'open'}
          onChange={(v) => set('poolCoverClosed', v === 'closed')}
          disabled={!config.poolCover || config.liftDeck}
        />
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-5">
        <p className="label">{t('configurator.lift_label')}</p>
        <Toggle
          options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
          value={config.liftDeck ? 'on' : 'off'}
          onChange={(v) => set('liftDeck', v === 'on')}
          disabled={blocked}
        />
        <p className="text-sm text-slate-500">
          {blocked ? t('configurator.lift_blocked_cover') : t('configurator.lift_note')}
        </p>
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.lift_position')}</p>
        <Toggle
          options={[
            { value: 'up',   label: t('configurator.lift_up') },
            { value: 'down', label: t('configurator.lift_down') },
          ]}
          value={config.liftDeckUp === false ? 'down' : 'up'}
          onChange={(v) => set('liftDeckUp', v === 'up')}
          disabled={!config.liftDeck}
        />
      </div>

      <div className="space-y-2">
        <p className="label">{t('configurator.solar_label')}</p>
        <Toggle
          options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
          value={config.liftDeck && config.liftDeckSolar ? 'on' : 'off'}
          onChange={(v) => set('liftDeckSolar', v === 'on')}
          disabled={!config.liftDeck}
        />
        <p className="text-sm text-slate-500">
          {config.liftDeck ? t('configurator.solar_note') : t('configurator.solar_hint')}
        </p>
      </div>
    </div>
  );
}

/* ─── Summary & Quote ─────────────────────────────────────────────── */
function SummaryStep({
  config, breakdown, isDealer, discountRate, showPrices: showPricesSetting, currency, region, loading, priceError,
  userId, userEmail, fullName, role,
}: {
  config: PoolConfig; breakdown: PriceBreakdown; isDealer: boolean; discountRate: number;
  showPrices?: boolean; currency: Currency; region: string;
  loading: boolean; priceError: string | null; userId: string; userEmail: string;
  fullName: string; role: 'customer' | 'dealer' | 'admin';
}) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [saving, setSaving] = useStateR(false);
  const [saved, setSaved] = useStateR(false);
  const [saveError, setSaveError] = useStateR<string | null>(null);
  const [showPopup, setShowPopup] = useStateR(false);

  const LANG_DIAL: Record<string, string> = {
    tr: '+90', en: '+44', de: '+49', nl: '+31', fr: '+33',
    es: '+34', it: '+39', pt: '+351', pl: '+48', ro: '+40',
    no: '+47', da: '+45', lt: '+370', el: '+30', ar: '+966',
  };
  const [contact, setContact] = useStateR({
    firstName: '', lastName: '', email: '', phone: '', dialCode: LANG_DIAL[lang] ?? '+90',
    address: '', postalCode: '', code: '',
  });
  // Doğrulama kodunun gönderildiği adres (adres değişirse yeniden kod istenir)
  const [codeSentTo, setCodeSentTo] = useStateR<string | null>(null);
  const [sendingCode, setSendingCode] = useStateR(false);
  const errText = (code: string) => {
    const key = `configurator.err_${code}`;
    const msg = t(key);
    return msg === key ? t('configurator.err_generic') : msg;
  };

  async function sendCode() {
    setSendingCode(true); setSaveError(null);
    try {
      const res = await fetch('/api/quote/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: contact.email, lang }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'generic');
      setCodeSentTo(contact.email.trim().toLowerCase());
    } catch (err) { setSaveError(errText(err instanceof Error ? err.message : 'generic')); }
    setSendingCode(false);
  }

  const isGuest = !userId;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim());
  const guestReady =
    !!contact.firstName.trim() && !!contact.lastName.trim() && emailLooksValid &&
    !!contact.address.trim() && !!contact.postalCode.trim() &&
    codeSentTo === contact.email.trim().toLowerCase() && /^\d{6}$/.test(contact.code);
  const fmtMoney = (v: number) => formatPrice(v, currency);
  // Misafir kullanıcıya fiyat asla gösterilmez
  const showPrices = !isGuest && (role === 'dealer' || role === 'admin' || (showPricesSetting ?? true));

  type GuestContact = {
    firstName: string; lastName: string; email: string; phone: string;
    address: string; postalCode: string; code: string;
  };
  async function submitRequest(contactInfo?: GuestContact) {
    setSaving(true); setSaveError(null); setSaved(false);
    try {
      // Tutar sunucuda hesaplanır; misafire fiyat dönmez
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config, region, contact: isGuest ? contactInfo : undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'generic');
      setSaved(true); setShowPopup(false); router.refresh();
    } catch (err) { setSaveError(errText(err instanceof Error ? err.message : 'generic')); }
    setSaving(false);
  }

  const panels = countPanels(config);

  const frameLabel: Record<string, string> = {
    anthracite: t('configurator.anthracite'),
    blue:       t('configurator.blue_color'),
    white:      t('configurator.white_color'),
  };
  const installationLabel: Record<string, string> = {
    ground:  t('configurator.install_ground'),
    partial: t('configurator.install_partial'),
    sunken:  t('configurator.install_sunken'),
  };
  const groundLabel: Record<string, string> = {
    gravel:   t('configurator.gravel'),
    wood:     t('configurator.wood_deck'),
    grass:    t('configurator.grass'),
    concrete: t('configurator.concrete'),
  };

  const rows: [string, string][] = [
    [t('configurator.row_size'),      `${config.length.toFixed(1)} × ${config.width.toFixed(1)} m`],
    [t('configurator.row_frame'),     frameLabel[config.frameColor] ?? config.frameColor],
    [t('configurator.row_panel'),     t('configurator.panel_glass_count').replace('{glass}', String(panels.glass)).replace('{closed}', String(panels.closed))],
    [t('configurator.lighting_inner_label'), config.lighting.enabled ? t('configurator.light_on_status').replace('{color}', config.lighting.color.toUpperCase()) : t('configurator.none')],
    [t('configurator.lighting_outer_label'), (() => {
      const o = outdoorLightingOf(config);
      return o.strip ? t('configurator.light_strip_label') : t('configurator.none');
    })()],
    [t('configurator.row_waterfall'), config.waterfall && !config.liftDeck ? t('configurator.yes') : t('configurator.none')],
    [t('configurator.entry_label'), ({
      small_stairs: t('configurator.entry_small'),
      wide_stairs: t('configurator.entry_wide'),
      bench: t('configurator.entry_bench'),
      none: t('configurator.none'),
    } as Record<string, string>)[poolEntryOf(config)]],
    [t('configurator.lift_label'), config.liftDeck ? t('configurator.yes') : t('configurator.none')],
    ...(config.liftDeck ? [[t('configurator.solar_label'), config.liftDeckSolar ? t('configurator.yes') : t('configurator.none')] as [string, string]] : []),
    [t('configurator.row_equipment'), EQUIPMENT.filter((e) => config.equipment?.[e.id]).map((e) => t(e.labelKey)).join(', ') || t('configurator.none')],
    [t('configurator.ext_sides_label'), extensionSidesOf(config).map((s) => t(`configurator.${s}`)).join(', ') || t('configurator.none')],
    [t('configurator.row_cover'),     config.poolCover && !config.liftDeck ? (config.poolCoverType === 'manual' ? t('configurator.cover_manual') : t('configurator.cover_auto')) : t('configurator.none')],
    [t('configurator.row_installation'), installationLabel[config.installation ?? 'ground']],
    [t('configurator.stair_style_label'), isSunken(config) || config.stairStyle === 'none' ? t('configurator.none') : config.stairStyle === 'block' ? t('configurator.stair_block') : t('configurator.stair_open')],
    [t('configurator.row_ground'),    groundLabel[config.ground] ?? config.ground],
    [t('configurator.row_cladding'),  isTileCladding(config.cladding)
      ? `${t('configurator.finish_mode_tile')} · ${CLADDING_TEXTURES.find((x) => `/textures/${x.file}` === config.cladding)?.name ?? t('configurator.cladding_custom')}`
      : `${t('configurator.finish_mode_color')} · ${t(POOL_COLORS.find((c) => c.value === config.cladding)?.labelKey ?? 'configurator.cladding_custom')}`],
  ];

  return (
    <div className="space-y-4">
      {/* Selections */}
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('configurator.selections')}
        </p>
        <ul className="space-y-1.5">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between text-sm">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-900">{v}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Price — only visible to dealers and admins */}
      {showPrices && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            {t('configurator.price_detail')}
          </p>
          {[
            [t('configurator.base_cost'),          breakdown.base],
            breakdown.frame    > 0 ? [t('configurator.frame'),             breakdown.frame]    : null,
            breakdown.panel    > 0 ? [t('configurator.glass_panels_cost'), breakdown.panel]    : null,
            [t('configurator.platform_cost'),       breakdown.platform],
            breakdown.ground   > 0 ? [t('configurator.subfloor_cost'),     breakdown.ground]   : null,
            breakdown.installation > 0 ? [t('configurator.installation_cost'), breakdown.installation] : null,
            breakdown.cladding > 0 ? [t('configurator.inner_cladding_cost'),breakdown.cladding]: null,
            breakdown.lighting > 0 ? [t('configurator.lighting'),          breakdown.lighting] : null,
            breakdown.waterfall> 0 ? [t('configurator.waterfall'),         breakdown.waterfall]: null,
            breakdown.poolCover> 0 ? [t('configurator.cover_label'),       breakdown.poolCover]: null,
            breakdown.liftDeck > 0 ? [t('configurator.lift_label'),        breakdown.liftDeck] : null,
            breakdown.equipment > 0 ? [t('configurator.equipment_title'),  breakdown.equipment] : null,
          ].filter(Boolean).map((row) => {
            const [label, val] = row as [string, number];
            return (
              <div key={label} className="flex justify-between text-sm text-slate-600">
                <span>{label}</span>
                <span>{fmtMoney(val)}</span>
              </div>
            );
          })}
          {isDealer && breakdown.discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-700 pt-1">
              <span>{t('configurator.dealer_discount_pct').replace('{n}', String(discountRate))}</span>
              <span>-{fmtMoney(breakdown.discount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 mt-2">
            <span className="text-sm font-semibold text-slate-700">{t('configurator.total')}</span>
            <span className="text-2xl font-bold text-brand-700">
              {loading ? '…' : fmtMoney(breakdown.total)}
            </span>
          </div>
          {priceError && <p className="text-xs text-red-600">{priceError}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => isGuest ? setShowPopup(true) : submitRequest()}
        disabled={saving || loading}
        className="btn-primary w-full py-3 text-base"
      >
        {saving ? t('configurator.sending_msg') : t('configurator.send_quote')}
      </button>
      {saved     && <p className="text-center text-sm text-emerald-700">{t('configurator.success_msg')}</p>}
      {saveError && <p className="text-center text-sm text-red-700">{saveError}</p>}
      {userEmail && <p className="text-center text-xs text-slate-400">{userEmail}</p>}

      {/* Guest popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPopup(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <button onClick={() => setShowPopup(false)} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
              </svg>
            </button>
            <h3 className="text-xl font-bold text-slate-900">{t('configurator.quote_title')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('configurator.quote_subtitle')}</p>
            <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3">
              <span className="text-sm text-slate-600">
                {config.length.toFixed(1)} × {config.width.toFixed(1)} m havuz konfigürasyonu
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('configurator.first_name_label')}</label>
                  <input type="text" className="input" autoComplete="given-name" value={contact.firstName}
                    onChange={e => setContact(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('configurator.last_name_label')}</label>
                  <input type="text" className="input" autoComplete="family-name" value={contact.lastName}
                    onChange={e => setContact(p => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{t('configurator.email_label')}</label>
                <div className="flex gap-2">
                  <input type="email" className="input flex-1" autoComplete="email" value={contact.email}
                    onChange={e => {
                      const v = e.target.value;
                      setContact(p => ({ ...p, email: v, code: '' }));
                      if (codeSentTo && v.trim().toLowerCase() !== codeSentTo) setCodeSentTo(null);
                    }}
                    placeholder="email@example.com" />
                  <button type="button" onClick={sendCode}
                    disabled={sendingCode || !emailLooksValid}
                    className="shrink-0 rounded-lg border border-brand-600 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40">
                    {sendingCode ? t('configurator.sending_msg') : codeSentTo ? t('configurator.verify_resend') : t('configurator.verify_send')}
                  </button>
                </div>
              </div>
              {codeSentTo && (
                <div>
                  <label className="label">{t('configurator.code_label')}</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    className="input tracking-[0.4em]" value={contact.code}
                    onChange={e => setContact(p => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                  <p className="mt-1 text-xs text-slate-500">{t('configurator.verify_sent').replace('{email}', codeSentTo)}</p>
                </div>
              )}
              <div>
                <label className="label">{t('configurator.phone_label')}</label>
                <CountryPhoneInput
                  dialCode={contact.dialCode}
                  phone={contact.phone}
                  onDialChange={(dial) => setContact((p) => ({ ...p, dialCode: dial }))}
                  onPhoneChange={(ph) => setContact((p) => ({ ...p, phone: ph }))}
                />
              </div>
              <div>
                <label className="label">{t('configurator.address_label')}</label>
                <textarea className="input min-h-[64px]" rows={2} autoComplete="street-address" value={contact.address}
                  onChange={e => setContact(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('configurator.postal_code_label')}</label>
                <input type="text" className="input" autoComplete="postal-code" maxLength={20} value={contact.postalCode}
                  onChange={e => setContact(p => ({ ...p, postalCode: e.target.value }))} />
              </div>
            </div>
            {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
            <button
              type="button"
              onClick={() => {
                if (!guestReady) return;
                submitRequest({
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email,
                  phone: contact.phone ? `${contact.dialCode}${contact.phone}` : '',
                  address: contact.address,
                  postalCode: contact.postalCode,
                  code: contact.code,
                });
              }}
              disabled={saving || !guestReady}
              className="btn-primary mt-6 w-full py-3 text-base disabled:opacity-50"
            >
              {saving ? t('configurator.sending_msg') : t('configurator.quote_send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
