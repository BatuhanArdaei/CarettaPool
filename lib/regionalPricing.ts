import { DEFAULT_PRICES, type CustomPrices } from './pricing';

export type Currency = 'TRY' | 'EUR' | 'USD';

export const CURRENCIES: { id: Currency; label: string; symbol: string }[] = [
  { id: 'TRY', label: 'Türk Lirası (TL)', symbol: '₺' },
  { id: 'EUR', label: 'Euro (€)', symbol: '€' },
  { id: 'USD', label: 'ABD Doları ($)', symbol: '$' },
];

/** Bölge eklendiğinde önerilen para birimi */
export const REGION_DEFAULT_CURRENCY: Record<string, Currency> = {
  turkey: 'TRY',
  europe: 'EUR',
  usa: 'USD',
  middle_east: 'USD',
};

/** Bir bölgenin fiyat listesi; tanımsız kalemler kod varsayılanından gelir (yalnızca TRY için anlamlı). */
export interface RegionPriceList {
  currency: Currency;
  prices: CustomPrices;
}

/** site_settings.regional_prices: bölge id → fiyat listesi */
export type RegionalPrices = Partial<Record<string, RegionPriceList>>;

export interface ResolvedRegionPrices {
  /** Fiyatın hesaplandığı bölge */
  region: string;
  currency: Currency;
  prices: CustomPrices | null;
  /** Bölge için ayrı liste tanımlı mı (değilse Türkiye listesi kullanılır) */
  configured: boolean;
}

/**
 * Bölgenin fiyat listesini çözer. Geriye uyum: eski tek liste (site_settings.prices)
 * Türkiye listesi sayılır. Listesi olmayan bölge Türkiye listesine (TL) düşer.
 */
export function resolveRegionPrices(
  regional: RegionalPrices | null,
  legacyPrices: CustomPrices | null,
  region: string,
): ResolvedRegionPrices {
  const own = regional?.[region];
  if (own) {
    // Kod varsayılanları TL'dir: başka para birimindeki listede tanımsız kalem 0 sayılır
    const prices: CustomPrices =
      own.currency === 'TRY'
        ? { ...(own.prices ?? {}) }
        : { ...Object.fromEntries(Object.keys(DEFAULT_PRICES).map((k) => [k, 0])), ...(own.prices ?? {}) };
    return { region, currency: own.currency, prices, configured: true };
  }
  const turkey = regional?.turkey;
  return {
    region,
    currency: turkey?.currency ?? 'TRY',
    prices: turkey?.prices ?? legacyPrices,
    configured: region === 'turkey',
  };
}

const LOCALE: Record<Currency, string> = { TRY: 'tr-TR', EUR: 'de-DE', USD: 'en-US' };

export function formatPrice(value: number, currency: Currency = 'TRY'): string {
  return new Intl.NumberFormat(LOCALE[currency] ?? 'tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
