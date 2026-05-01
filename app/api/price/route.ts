import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyDealerDiscount, calculateBasePrice } from '@/lib/pricing';
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

  const breakdown = calculateBasePrice(config);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isDealer = false;
  let discountRate = 0;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'dealer') {
      const { data: dealer } = await supabase
        .from('dealers')
        .select('discount_rate')
        .eq('user_id', user.id)
        .single();
      if (dealer) {
        isDealer = true;
        discountRate = Number(dealer.discount_rate ?? 0);
      }
    }
  }

  const finalBreakdown = isDealer ? applyDealerDiscount(breakdown, discountRate) : breakdown;

  return NextResponse.json({
    breakdown: finalBreakdown,
    isDealer,
    discountRate,
  });
}
