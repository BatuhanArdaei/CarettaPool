'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/supabase/adminGuard';
import { DEFAULT_PRICES } from '@/lib/pricing';
import { REGIONS } from '@/lib/regions';
import { CURRENCIES, type Currency, type RegionalPrices } from '@/lib/regionalPricing';

/** Tarayıcıdan gelen listeyi doğrular: bilinen bölge, para birimi ve fiyat anahtarları; negatif olmayan sayılar. */
function sanitizeRegional(input: unknown): RegionalPrices {
  if (!input || typeof input !== 'object') throw new Error('Geçersiz fiyat listesi');
  const out: RegionalPrices = {};
  for (const [regionId, list] of Object.entries(input as Record<string, unknown>)) {
    if (!REGIONS.some((r) => r.id === regionId)) throw new Error(`Bilinmeyen bölge: ${regionId}`);
    const { currency, prices } = (list ?? {}) as { currency?: unknown; prices?: unknown };
    if (!CURRENCIES.some((c) => c.id === currency)) throw new Error(`Geçersiz para birimi: ${String(currency)}`);
    const clean: Record<string, number> = {};
    for (const [key, value] of Object.entries((prices ?? {}) as Record<string, unknown>)) {
      if (!(key in DEFAULT_PRICES)) continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Geçersiz fiyat: ${key}`);
      clean[key] = n;
    }
    out[regionId] = { currency: currency as Currency, prices: clean };
  }
  return out;
}

export async function savePriceSettings(regional: unknown, showPrices: boolean) {
  const supabase = await assertAdmin();
  const clean = sanitizeRegional(regional);
  const now = new Date().toISOString();
  const results = await Promise.all([
    supabase.from('site_settings').upsert({ key: 'regional_prices', value: clean, updated_at: now }, { onConflict: 'key' }),
    // Geriye uyum: Türkiye listesi eski anahtarda da tutulur
    supabase.from('site_settings').upsert({ key: 'prices', value: clean.turkey?.prices ?? {}, updated_at: now }, { onConflict: 'key' }),
    supabase.from('site_settings').upsert({ key: 'show_prices', value: showPrices === true, updated_at: now }, { onConflict: 'key' }),
  ]);
  const error = results.find((r) => r.error)?.error;
  if (error) throw new Error(error.message);
  revalidatePath('/admin/fiyatlar');
}
