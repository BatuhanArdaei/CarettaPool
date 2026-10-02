import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computePrice } from '@/lib/priceServer';
import type { PoolConfig } from '@/lib/types';

export async function POST(request: NextRequest) {
  let body: { config?: PoolConfig; region?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const config = body.config;
  if (!config || typeof config.width !== 'number' || typeof config.length !== 'number') {
    return NextResponse.json({ error: 'invalid_config' }, { status: 400 });
  }

  const ctx = await computePrice(createClient(), config, body.region);

  // Fiyat gösterilmeyecekse (misafir, ya da site ayarı kapalı) fiyat bilgisi hiç gönderilmez
  if (!ctx.showPrices) {
    return NextResponse.json({ breakdown: null, isDealer: ctx.isDealer, discountRate: 0, showPrices: false, region: ctx.region });
  }

  return NextResponse.json({
    breakdown: ctx.breakdown,
    isDealer: ctx.isDealer,
    discountRate: ctx.discountRate,
    showPrices: true,
    region: ctx.region,
    currency: ctx.currency,
  });
}
