'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PRICES, type PriceKey } from '@/lib/pricing';
import { EQUIPMENT } from '@/lib/equipment';
import { REGIONS, getRegion } from '@/lib/regions';
import { savePriceSettings } from './actions';
import { CURRENCIES, REGION_DEFAULT_CURRENCY, type Currency, type RegionPriceList, type RegionalPrices } from '@/lib/regionalPricing';

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
      { key: 'cladding_color'       as PriceKey, label: 'Kaplama – Diğer palet renkleri', unit: 'TL' },
    ],
  },
  {
    label: 'Işıklandırma',
    icon: '💡',
    items: [
      { key: 'lighting' as PriceKey, label: 'İç Aydınlatma (RGB)', unit: 'TL' },
      { key: 'light_strip_outdoor' as PriceKey, label: 'Dış – Şerit LED', unit: 'TL' },
    ],
  },
  {
    label: 'Platform & Ekstralar',
    icon: '🏗️',
    items: [
      { key: 'platform'           as PriceKey, label: 'Yan Platform (standart)', unit: 'TL' },
      { key: 'platform_extension' as PriceKey, label: 'Platform Genişletme',     unit: 'TL' },
      { key: 'side_extension'     as PriceKey, label: 'Kenar Terası (kenar başı)', unit: 'TL' },
      { key: 'installation_partial' as PriceKey, label: 'Kurulum – Yarı Gömülü (kazı)', unit: 'TL' },
      { key: 'installation_sunken'  as PriceKey, label: 'Kurulum – Tam Gömülü (kazı)',  unit: 'TL' },
      { key: 'waterfall'          as PriceKey, label: 'Şelale',                  unit: 'TL' },
    ],
  },
  {
    label: 'Üst Kapak',
    icon: '🔲',
    items: [
      { key: 'pool_cover_manual'    as PriceKey, label: 'Üst Kapak – Manuel',    unit: 'TL' },
      { key: 'pool_cover_automatic' as PriceKey, label: 'Üst Kapak – Otomatik',  unit: 'TL' },
      { key: 'lift_deck'            as PriceKey, label: 'Hareketli Güverte',     unit: 'TL' },
      { key: 'lift_deck_solar'      as PriceKey, label: 'Güverte – Güneş Paneli', unit: 'TL' },
    ],
  },
  {
    label: 'Aksesuarlar',
    icon: '🪜',
    items: [
      { key: 'railings' as PriceKey, label: 'Korkuluk',    unit: 'TL' },
      { key: 'stairs_block' as PriceKey, label: 'Blok Basamak (platform merdiveni)', unit: 'TL' },
      { key: 'entry_small_stairs' as PriceKey, label: 'Havuz İçi – Küçük Basamak',   unit: 'TL' },
      { key: 'entry_wide_stairs'  as PriceKey, label: 'Havuz İçi – Geniş Basamak',   unit: 'TL' },
      { key: 'entry_bench'        as PriceKey, label: 'Havuz İçi – Oturaklı Basamak', unit: 'TL' },
    ],
  },
  {
    label: 'Ekipmanlar',
    icon: '⚙️',
    items: EQUIPMENT.map((e) => ({ key: e.priceKey, label: e.adminLabel, unit: 'TL' })),
  },
];

type Prices = Record<string, number>;

/** TL listelerinde tanımsız kalem kod varsayılanını, diğer para birimlerinde 0'ı kullanır. */
function valueOf(list: RegionPriceList, key: PriceKey): number {
  const v = list.prices?.[key];
  if (typeof v === 'number') return v;
  return list.currency === 'TRY' ? DEFAULT_PRICES[key] : 0;
}

function fullList(currency: Currency, source?: Partial<Record<string, number>>): RegionPriceList {
  const prices: Prices = {};
  PRICE_GROUPS.forEach(g => g.items.forEach(i => {
    prices[i.key] = source?.[i.key] ?? (currency === 'TRY' ? DEFAULT_PRICES[i.key] : 0);
  }));
  return { currency, prices };
}

export default function AdminFiyatlar() {
  const supabase = createClient();
  const [regional, setRegional] = useState<RegionalPrices>({});
  const [regionId, setRegionId] = useState<string>('turkey');
  const [showPricesEnabled, setShowPricesEnabled] = useState<boolean>(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('site_settings').select('value').eq('key', 'prices').maybeSingle(),
      supabase.from('site_settings').select('value').eq('key', 'regional_prices').maybeSingle(),
      supabase.from('site_settings').select('value').eq('key', 'show_prices').maybeSingle(),
    ]).then(([legacyRes, regionalRes, showRes]) => {
      const stored = (regionalRes.data?.value && typeof regionalRes.data.value === 'object'
        ? regionalRes.data.value
        : {}) as RegionalPrices;
      // Geriye uyum: eski tek liste Türkiye listesi olarak yüklenir
      const legacy = (legacyRes.data?.value && typeof legacyRes.data.value === 'object' ? legacyRes.data.value : undefined) as Prices | undefined;
      const turkey = stored.turkey ?? fullList('TRY', legacy);
      setRegional({ ...stored, turkey: { ...turkey, prices: { ...fullList(turkey.currency).prices, ...turkey.prices } } });
      if (showRes.data !== null && showRes.data?.value !== undefined) {
        setShowPricesEnabled(Boolean(showRes.data.value));
      }
      setLoaded(true);
    });
  }, []);

  const region = getRegion(regionId);
  const list = regional[regionId];
  const symbol = CURRENCIES.find(c => c.id === list?.currency)?.symbol ?? '';

  function updateList(next: RegionPriceList | undefined) {
    setRegional(prev => {
      const copy = { ...prev };
      if (next) copy[regionId] = next;
      else delete copy[regionId];
      return copy;
    });
  }

  async function save() {
    setStatus('saving');
    try {
      // Yazma sunucuda, admin kontrolü ve doğrulamayla yapılır
      await savePriceSettings(regional, showPricesEnabled);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
    }
  }

  function reset() {
    if (!list) return;
    updateList(fullList(list.currency));
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
      {/* Fiyat Görünürlük Toggleı */}
      <div className={`rounded-xl p-5 ring-2 transition ${showPricesEnabled ? 'bg-emerald-50 ring-emerald-300' : 'bg-slate-50 ring-slate-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900">Fiyatlar Gözüksün Mü?</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {showPricesEnabled
                ? 'Fiyatlar giriş yapmış müşterilere de gösterilir (misafirlere hiçbir zaman gösterilmez).'
                : 'Fiyatlar gizli — sadece bayi ve admin hesapları görebilir.'}
            </p>
          </div>
          <div className="flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => setShowPricesEnabled(true)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                showPricesEnabled ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Evet
            </button>
            <button
              type="button"
              onClick={() => setShowPricesEnabled(false)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                !showPricesEnabled ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hayır
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fiyat Yönetimi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Her bölgenin kendi fiyat listesi ve para birimi vardır. Bayi, kayıtlı olduğu bölgenin
            listesini görür; bayi özel fiyatları bu değerleri geçersiz kılar.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {list && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Varsayılana Dön
            </button>
          )}
          <button type="button" onClick={save} disabled={status === 'saving'} className="btn-primary px-6">
            {status === 'saving' ? 'Kaydediliyor…' : 'Fiyatları Kaydet'}
          </button>
        </div>
      </div>

      {status === 'saved' && (
        <div className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          ✓ Ayarlar kaydedildi. Tüm hesaplamalar artık bu değerleri kullanacak.
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          Kayıt sırasında hata oluştu. Lütfen tekrar deneyin.
        </div>
      )}

      {/* Bölge sekmeleri */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bölge">
        {REGIONS.map(r => {
          const active = r.id === regionId;
          const has = Boolean(regional[r.id]);
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRegionId(r.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ring-1 transition ${
                active ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {r.name}
              <span className={`rounded px-1.5 py-0.5 text-[11px] ${active ? 'bg-white/20' : has ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                {has ? regional[r.id]!.currency : 'tanımsız'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bölge liste ayarları */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900">{region.name} fiyat listesi</p>
            <p className="text-xs text-slate-500">{region.note}</p>
          </div>
          {list && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600" htmlFor="currency">Para birimi</label>
              <select
                id="currency"
                className="input w-44"
                value={list.currency}
                onChange={e => updateList({ ...list, currency: e.target.value as Currency })}
              >
                {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {regionId !== 'turkey' && (
                <button
                  type="button"
                  onClick={() => updateList(undefined)}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Listeyi kaldır
                </button>
              )}
            </div>
          )}
        </div>

        {!list && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              Bu bölge için ayrı fiyat listesi yok. Şu an <strong>Türkiye listesi ({regional.turkey?.currency ?? 'TRY'})</strong> kullanılıyor.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => updateList(fullList(REGION_DEFAULT_CURRENCY[regionId] ?? 'TRY', regional.turkey?.prices))}
              >
                Türkiye fiyatlarından kopyala ({REGION_DEFAULT_CURRENCY[regionId] ?? 'TRY'})
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => updateList(fullList(REGION_DEFAULT_CURRENCY[regionId] ?? 'TRY'))}
              >
                Boş liste oluştur
              </button>
            </div>
            <p className="mt-2 text-xs">Kopyalanan tutarlar sayısal olarak aktarılır; para birimine göre güncellemeyi unutmayın.</p>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Fiyat katmanları nasıl çalışır?</p>
        <ol className="mt-1.5 list-inside list-decimal space-y-0.5">
          <li>Müşteri seçtiği bölgenin, bayi kayıtlı olduğu bölgenin listesini görür (listesi olmayan bölge Türkiye listesini kullanır).</li>
          <li>Bayi &quot;Yüzdelik İndirim&quot; modundaysa → bölge fiyatları üzerine indirim uygulanır.</li>
          <li>Bayi &quot;Özel Fiyatlar&quot; modundaysa → bayi fiyatları bölge fiyatlarını kalem kalem geçersiz kılar.</li>
          <li>Misafir kullanıcılar hiçbir zaman fiyat görmez.</li>
        </ol>
      </div>

      {/* Price groups */}
      {showPricesEnabled && list && (
        <div className="space-y-5">
          {PRICE_GROUPS.map(group => (
            <div key={group.label} className="rounded-xl bg-white ring-1 ring-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                <span className="text-lg">{group.icon}</span>
                <h2 className="font-semibold text-slate-800">{group.label}</h2>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(item => {
                  const value = valueOf(list, item.key);
                  const isDefault = list.currency === 'TRY' && value === DEFAULT_PRICES[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between gap-3 rounded-lg p-3 ring-1 transition ${
                        isDefault ? 'bg-slate-50 ring-slate-200' : 'bg-brand-50 ring-brand-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                        {list.currency === 'TRY' && (
                          <p className="text-[11px] text-slate-400">
                            Kod varsayılanı: {DEFAULT_PRICES[item.key].toLocaleString('tr-TR')} ₺
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={list.currency === 'TRY' ? 100 : 10}
                          value={value}
                          onChange={e =>
                            updateList({ ...list, prices: { ...list.prices, [item.key]: Math.max(0, Number(e.target.value)) } })
                          }
                          className="input w-28 text-right text-sm"
                        />
                        <span className="w-4 text-xs text-slate-500">{symbol}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showPricesEnabled && (
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-sm text-slate-400">Fiyat paneli gizli — fiyatları göstermek için yukarıdaki toggleı &quot;Evet&quot; yapın.</p>
        </div>
      )}

      {/* Save bar (sticky bottom) */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button type="button" onClick={save} disabled={status === 'saving'} className="btn-primary px-8 py-3 shadow-lg">
          {status === 'saving' ? 'Kaydediliyor…' : '✓ Kaydet'}
        </button>
      </div>
    </div>
  );
}
