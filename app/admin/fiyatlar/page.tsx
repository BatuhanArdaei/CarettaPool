'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PRICES, type PriceKey } from '@/lib/pricing';

const PRICE_GROUPS = [
  {
    label: 'Taban & Panel',
    icon: '📐',
    items: [
      { key: 'base_per_sqm' as PriceKey, label: 'Taban Fiyat (m² başına)', unit: 'TL/m²' },
      { key: 'panel_glass'  as PriceKey, label: 'Cam Panel (segment başı)',  unit: 'TL' },
    ],
  },
  {
    label: 'Çerçeve',
    icon: '🔩',
    items: [
      { key: 'frame_blue'       as PriceKey, label: 'Çerçeve – Mavi',     unit: 'TL' },
      { key: 'frame_white'      as PriceKey, label: 'Çerçeve – Beyaz',    unit: 'TL' },
      { key: 'frame_anthracite' as PriceKey, label: 'Çerçeve – Antrasit', unit: 'TL' },
    ],
  },
  {
    label: 'Zemin',
    icon: '🪨',
    items: [
      { key: 'ground_wood'     as PriceKey, label: 'Zemin – Tahta Deck', unit: 'TL' },
      { key: 'ground_grass'    as PriceKey, label: 'Zemin – Çimen',      unit: 'TL' },
      { key: 'ground_concrete' as PriceKey, label: 'Zemin – Beton',      unit: 'TL' },
      { key: 'ground_gravel'   as PriceKey, label: 'Zemin – Çakıl',      unit: 'TL' },
    ],
  },
  {
    label: 'Kaplama',
    icon: '🎨',
    items: [
      { key: 'cladding_blue_mosaic' as PriceKey, label: 'Kaplama – Mavi Mozaik',       unit: 'TL' },
      { key: 'cladding_gray_stone'  as PriceKey, label: 'Kaplama – Gri Taş',           unit: 'TL' },
      { key: 'cladding_turquoise'   as PriceKey, label: 'Kaplama – Turkuaz',            unit: 'TL' },
      { key: 'cladding_texture'     as PriceKey, label: 'Kaplama – Doku (tüm desenler)',unit: 'TL' },
      { key: 'cladding_white'       as PriceKey, label: 'Kaplama – Beyaz (standart)',   unit: 'TL' },
    ],
  },
  {
    label: 'Ekipman & Opsiyonlar',
    icon: '⚡',
    items: [
      { key: 'lighting'  as PriceKey, label: 'Işıklandırma', unit: 'TL' },
      { key: 'waterfall' as PriceKey, label: 'Şelale',       unit: 'TL' },
      { key: 'pool_cover' as PriceKey, label: 'Üst Kapak (Otomatik Panjur)', unit: 'TL' },
      { key: 'platform'  as PriceKey, label: 'Yan Platform',  unit: 'TL' },
    ],
  },
];

type Prices = Record<string, number>;

export default function AdminFiyatlar() {
  const supabase = createClient();
  const [prices, setPrices] = useState<Prices>(() => {
    const init: Prices = {};
    PRICE_GROUPS.forEach(g => g.items.forEach(i => { init[i.key] = DEFAULT_PRICES[i.key]; }));
    return init;
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'prices')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object') {
          const stored = data.value as Prices;
          setPrices(prev => ({ ...prev, ...stored }));
        }
        setLoaded(true);
      });
  }, []);

  async function save() {
    setStatus('saving');
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'prices', value: prices }, { onConflict: 'key' });
    setStatus(error ? 'error' : 'saved');
    if (!error) setTimeout(() => setStatus('idle'), 2500);
  }

  function reset() {
    const init: Prices = {};
    PRICE_GROUPS.forEach(g => g.items.forEach(i => { init[i.key] = DEFAULT_PRICES[i.key]; }));
    setPrices(init);
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fiyat Yönetimi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tüm müşteri ve bayi hesaplarına uygulanacak site genelindeki temel fiyatlar.
            Bayi özel fiyatları bu değerleri geçersiz kılar.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Varsayılana Dön
          </button>
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className="btn-primary px-6"
          >
            {status === 'saving' ? 'Kaydediliyor…' : 'Fiyatları Kaydet'}
          </button>
        </div>
      </div>

      {status === 'saved' && (
        <div className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          ✓ Fiyatlar kaydedildi. Tüm hesaplamalar artık bu değerleri kullanacak.
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          Kayıt sırasında hata oluştu. Lütfen tekrar deneyin.
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Fiyat katmanları nasıl çalışır?</p>
        <ol className="mt-1.5 list-inside list-decimal space-y-0.5">
          <li>Bu sayfadaki değerler site geneli varsayılan olarak uygulanır.</li>
          <li>Bayi "Yüzdelik İndirim" modundaysa → bu fiyatlar üzerine indirim eklenir.</li>
          <li>Bayi "Özel Fiyatlar" modundaysa → bayi fiyatları bu değerleri kalem kalem geçersiz kılar.</li>
        </ol>
      </div>

      {/* Price groups */}
      <div className="space-y-5">
        {PRICE_GROUPS.map(group => (
          <div key={group.label} className="rounded-xl bg-white ring-1 ring-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <span className="text-lg">{group.icon}</span>
              <h2 className="font-semibold text-slate-800">{group.label}</h2>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map(item => {
                const isDefault = prices[item.key] === DEFAULT_PRICES[item.key];
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between gap-3 rounded-lg p-3 ring-1 transition ${
                      isDefault ? 'bg-slate-50 ring-slate-200' : 'bg-brand-50 ring-brand-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-400">
                        Kod varsayılanı: {DEFAULT_PRICES[item.key].toLocaleString('tr-TR')} {item.unit}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={100}
                        value={prices[item.key]}
                        onChange={e =>
                          setPrices(p => ({ ...p, [item.key]: Math.max(0, Number(e.target.value)) }))
                        }
                        className="input w-28 text-right text-sm"
                      />
                      <span className="text-xs text-slate-500">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save bar (sticky bottom) */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={status === 'saving'}
          className="btn-primary px-8 py-3 shadow-lg"
        >
          {status === 'saving' ? 'Kaydediliyor…' : '✓ Fiyatları Kaydet'}
        </button>
      </div>
    </div>
  );
}
