import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyDealerDiscount, calculateBasePrice, type CustomPrices } from '@/lib/pricing';
import type { PoolConfig } from '@/lib/types';

export async function POST(request: NextRequest) {
  let body: { config?: PoolConfig };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const config = body.config;
  if (!config || typeof config.width !== 'number' || typeof config.length !== 'number') {
    return NextResponse.json({ error: 'invalid_config' }, { status: 400 });
  }

  const supabase = createClient();

  // 1. Fetch global site prices from site_settings (admin-configurable defaults)
  let globalPrices: CustomPrices | null = null;
  const { data: settingsRows } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'prices')
    .maybeSingle();
  if (settingsRows?.value && typeof settingsRows.value === 'object') {
    globalPrices = settingsRows.value as CustomPrices;
  }

  // 2. Fetch logged-in user and dealer info
  const { data: { user } } = await supabase.auth.getUser();

  let isDealer = false;
  let discountRate = 0;
  let discountType: 'percentage' | 'custom' = 'percentage';
  let dealerCustomPrices: CustomPrices | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

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
      }
    }
  }

  // 3. Build effective prices:
  //    globalPrices override code defaults;
  //    dealerCustomPrices override globalPrices (only in 'custom' mode)
  let effectivePrices: CustomPrices | null = globalPrices;

  if (isDealer && discountType === 'custom' && dealerCustomPrices) {
    effectivePrices = { ...globalPrices, ...dealerCustomPrices };
  }

  // 4. Calculate
  const breakdown = calculateBasePrice(config, effectivePrices);

  // 5. Apply percentage discount (only in 'percentage' mode)
  const finalBreakdown =
    isDealer && discountType === 'percentage' && discountRate > 0
      ? applyDealerDiscount(breakdown, discountRate)
      : breakdown;

  return NextResponse.json({
    breakdown: finalBreakdown,
    isDealer,
    discountRate: discountType === 'custom' ? 0 : discountRate,
  });
}
