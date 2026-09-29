'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { NO_ADJUST, type PlacementAdjust } from './TemplateScene';

const DIRECTIONS = [0, 90, 180, 270] as const;

/** Kuşbakışı havuz (dikdörtgen) + platform (dolu kare) ikonu, verilen yöne döndürülmüş. */
function DirectionIcon({ deg }: { deg: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <g transform={`rotate(${deg} 12 12)`}>
        <rect x="3" y="7" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="17" y="7" width="4" height="10" rx="1" fill="currentColor" />
      </g>
    </svg>
  );
}

/** "Mekânda Gör" düzenleme modunda: 4 yön seçimi, sıfırlama ve bitirme. */
export default function PlacementBar({
  adjust,
  onChange,
  onDone,
}: {
  adjust: PlacementAdjust;
  onChange: (adjust: PlacementAdjust) => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="absolute inset-x-2 bottom-1.5 z-10 mx-auto flex max-w-md flex-col gap-1 rounded-xl bg-white/90 p-1.5 shadow-lg ring-1 ring-slate-200 backdrop-blur-sm sm:bottom-3 sm:p-2">
      <p className="hidden px-1 text-center text-xs text-slate-500 sm:block">{t('configurator.place_hint')}</p>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="shrink-0 pl-1 text-xs font-medium text-slate-600">{t('configurator.place_rotate')}</span>
        <div className="flex flex-1 justify-center gap-1" role="radiogroup" aria-label={t('configurator.place_rotate')}>
          {DIRECTIONS.map((deg) => {
            const active = adjust.rot === deg;
            return (
              <button
                key={deg}
                type="button"
                role="radio"
                aria-checked={active}
                title={`${deg}°`}
                onClick={() => onChange({ ...adjust, rot: deg })}
                className={`flex h-9 w-9 items-center justify-center rounded-md ring-1 transition ${
                  active ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <DirectionIcon deg={deg} />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onChange(NO_ADJUST)}
          className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          {t('configurator.place_reset')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
        >
          {t('configurator.place_done')}
        </button>
      </div>
    </div>
  );
}

/** Düzenleme modunu açan buton. */
export function PlacementButton({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('configurator.place_edit')}
      className="absolute bottom-1.5 left-2 z-10 flex h-8 items-center gap-1.5 rounded-lg bg-white/90 px-2 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white sm:bottom-3 sm:left-3 sm:h-12 sm:px-3"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v16M2 10h16M10 2 7.5 4.5M10 2l2.5 2.5M10 18l-2.5-2.5M10 18l2.5-2.5M2 10l2.5-2.5M2 10l2.5 2.5M18 10l-2.5-2.5M18 10l-2.5 2.5" />
      </svg>
      <span className="hidden sm:inline">{t('configurator.place_edit')}</span>
    </button>
  );
}
