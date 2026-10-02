import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { computePrice } from '@/lib/priceServer';
import { formatPrice } from '@/lib/regionalPricing';
import type { PoolConfig } from '@/lib/types';

/**
 * Teklif talebi: tutar sunucuda hesaplanır (tarayıcıdan gelen fiyata güvenilmez).
 * Misafir taleplerinde tutar kaydedilir ama kullanıcıya döndürülmez.
 */
export async function POST(request: NextRequest) {
  let body: { config?: PoolConfig; region?: string; contact?: { name?: string; email?: string; phone?: string } };
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const c = body.contact;
    if (!c?.name || !c?.email) return NextResponse.json({ error: 'contact_required' }, { status: 400 });
  }

  let ctx: Awaited<ReturnType<typeof computePrice>>;
  try {
    ctx = await computePrice(supabase, config, body.region);
  } catch {
    return NextResponse.json({ error: 'invalid_config' }, { status: 400 });
  }

  // Kayıt yalnızca sunucudan yapılır (veritabanında herkese açık insert izni yoktur);
  // böylece tutar dışarıdan değiştirilemez.
  const db = createAdminClient();
  const { error } = await db.from('pool_configs').insert({
    user_id: user?.id ?? null,
    // Fiyatın hesaplandığı bölge ve para birimi teklifle birlikte saklanır
    config: { ...config, priceRegion: ctx.region, currency: ctx.currency } as unknown as Record<string, unknown>,
    total_price: ctx.breakdown.total,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!user && body.contact) {
    const c = body.contact;
    const { error: cErr } = await db.from('contact_requests').insert({
      name: String(c.name).slice(0, 200),
      email: String(c.email).slice(0, 200),
      phone: c.phone ? String(c.phone).slice(0, 40) : null,
      message: `Havuz Teklif Talebi — ${config.length.toFixed(1)}×${config.width.toFixed(1)} m, ${formatPrice(ctx.breakdown.total, ctx.currency)} (${ctx.region})`,
    });
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
