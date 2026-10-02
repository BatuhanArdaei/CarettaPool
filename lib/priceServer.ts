import type { createClient } from '@/lib/supabase/server';
import { applyDealerDiscount, calculateBasePrice, type CustomPrices, type PriceBreakdown } from '@/lib/pricing';
import { REGIONS } from '@/lib/regions';
import { resolveRegionPrices, type Currency, type RegionalPrices } from '@/lib/regionalPricing';
import type { PoolConfig } from '@/lib/types';

type Supabase = ReturnType<typeof createClient>;

export interface PriceContext {
  breakdown: PriceBreakdown;
  isGuest: boolean;
  isDealer: boolean;
  discountRate: number;
  /** Fiyat kullanıcıya gösterilebilir mi (misafire asla) */
  showPrices: boolean;
  /** Fiyatın hesaplandığı bölge ve para birimi */
  region: string;
  currency: Currency;
  /** Bölgenin kendi fiyat listesi var mı */
  regionConfigured: boolean;
}

const isRegion = (id: unknown): id is string => typeof id === 'string' && REGIONS.some((r) => r.id === id);

/**
 * Oturumdaki kullanıcıya göre fiyatı sunucuda hesaplar:
 * kod varsayılanları ← bölge fiyat listesi ← bayi özel fiyatları (custom mod);
 * yüzde modunda bayi indirimi uygulanır.
 * Bölge: bayi için kayıtlı bölgesi (tarayıcıdan gelen değer yok sayılır), diğerleri için seçtiği bölge.
 */
export async function computePrice(supabase: Supabase, config: PoolConfig, requestedRegion?: unknown): Promise<PriceContext> {
  let legacyPrices: CustomPrices | null = null;
  let regionalPrices: RegionalPrices | null = null;
  let showPricesSetting = true;
  const { data: allSettings } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['prices', 'regional_prices', 'show_prices']);
  for (const row of allSettings ?? []) {
    if (row.key === 'prices' && row.value && typeof row.value === 'object') legacyPrices = row.value as CustomPrices;
    if (row.key === 'regional_prices' && row.value && typeof row.value === 'object') regionalPrices = row.value as RegionalPrices;
    if (row.key === 'show_prices') showPricesSetting = row.value !== false;
  }

  const { data: { user } } = await supabase.auth.getUser();

  let isDealer = false;
  let isAdmin = false;
  let discountRate = 0;
  let discountType: 'percentage' | 'custom' = 'percentage';
  let dealerCustomPrices: CustomPrices | null = null;
  let region = isRegion(requestedRegion) ? requestedRegion : 'turkey';

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    isAdmin = profile?.role === 'admin';
    if (profile?.role === 'dealer') {
      const { data: dealer } = await supabase
        .from('dealers')
        .select('discount_rate, discount_type, custom_prices, is_active')
        .eq('user_id', user.id)
        .single();
      if (dealer && dealer.is_active !== false) {
        isDealer = true;
        discountRate = Number(dealer.discount_rate ?? 0);
        discountType = (dealer.discount_type ?? 'percentage') as 'percentage' | 'custom';
        dealerCustomPrices = (dealer.custom_prices ?? null) as CustomPrices | null;
        region = await dealerRegionOf(supabase, user.id);
      }
    }
  }

  const resolved = resolveRegionPrices(regionalPrices, legacyPrices, region);
  let effectivePrices: CustomPrices | null = resolved.prices;
  if (isDealer && discountType === 'custom' && dealerCustomPrices) {
    effectivePrices = { ...effectivePrices, ...dealerCustomPrices };
  }

  const base = calculateBasePrice(config, effectivePrices);
  const breakdown =
    isDealer && discountType === 'percentage' && discountRate > 0 ? applyDealerDiscount(base, discountRate) : base;

  return {
    breakdown,
    isGuest: !user,
    isDealer,
    discountRate: discountType === 'custom' ? 0 : discountRate,
    showPrices: !!user && (isDealer || isAdmin || showPricesSetting),
    region,
    currency: resolved.currency,
    regionConfigured: resolved.configured,
  };
}

/** Bayinin kayıtlı bölgesi; kolon yoksa (göç uygulanmamışsa) ya da boşsa 'turkey'. */
export async function dealerRegionOf(supabase: Supabase, userId: string): Promise<string> {
  const { data, error } = await supabase.from('dealers').select('region').eq('user_id', userId).single();
  if (error || !isRegion(data?.region)) return 'turkey';
  return data.region;
}
