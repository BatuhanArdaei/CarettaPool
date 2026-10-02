'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/supabase/adminGuard';
import { DEFAULT_PRICES } from '@/lib/pricing';
import { REGIONS } from '@/lib/regions';

export async function updateDealerDiscount(id: string, discountRate: number) {
  return updateDealer(id, { discount_rate: discountRate });
}

export interface DealerPatch {
  is_active?: boolean;
  discount_rate?: number;
  discount_type?: 'percentage' | 'custom';
  region?: string;
  custom_prices?: Record<string, number>;
}

/** Yalnızca izin verilen alanları doğrulayıp yazar. Hata durumunda { error } döner. */
export async function updateDealer(id: string, patch: DealerPatch): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const row: Record<string, unknown> = {};

  if (patch.is_active !== undefined) row.is_active = patch.is_active === true;
  if (patch.discount_rate !== undefined) {
    const n = Number(patch.discount_rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: 'İndirim oranı 0–100 arasında olmalı' };
    row.discount_rate = n;
  }
  if (patch.discount_type !== undefined) {
    if (patch.discount_type !== 'percentage' && patch.discount_type !== 'custom') return { error: 'Geçersiz indirim tipi' };
    row.discount_type = patch.discount_type;
  }
  if (patch.region !== undefined) {
    if (!REGIONS.some((r) => r.id === patch.region)) return { error: 'Geçersiz bölge' };
    row.region = patch.region;
  }
  if (patch.custom_prices !== undefined) {
    const clean: Record<string, number> = {};
    for (const [key, value] of Object.entries(patch.custom_prices ?? {})) {
      if (!(key in DEFAULT_PRICES)) continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return { error: `Geçersiz fiyat: ${key}` };
      clean[key] = n;
    }
    row.custom_prices = clean;
  }
  if (Object.keys(row).length === 0) return {};

  const { error } = await supabase.from('dealers').update(row).eq('id', id);
  revalidatePath('/admin/bayiler');
  return error ? { error: error.message } : {};
}
