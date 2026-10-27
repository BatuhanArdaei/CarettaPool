import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { computePrice } from '@/lib/priceServer';
import { formatPrice } from '@/lib/regionalPricing';
import type { PoolConfig } from '@/lib/types';
import { checkVerificationCode, normalizeEmail } from '@/lib/emailVerification';

interface GuestContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  /** E-postaya gönderilen 6 haneli doğrulama kodu */
  code?: string;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Teklif talebi: tutar sunucuda hesaplanır (tarayıcıdan gelen fiyata güvenilmez).
 * Misafir taleplerinde tutar kaydedilir ama kullanıcıya döndürülmez; misafirin e-postası
 * gönderilen kodla doğrulanmadan talep kaydedilmez.
 */
export async function POST(request: NextRequest) {
  let body: { config?: PoolConfig; region?: string; contact?: GuestContact };
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

  // Misafir: ad, soyad, e-posta, adres, posta kodu zorunlu; e-posta kodla doğrulanır
  let guest: { firstName: string; lastName: string; email: string; phone: string; address: string; postalCode: string } | null = null;
  if (!user) {
    const c = body.contact ?? {};
    const email = normalizeEmail(c.email);
    guest = {
      firstName: clip(c.firstName, 100),
      lastName: clip(c.lastName, 100),
      email: email ?? '',
      phone: clip(c.phone, 40),
      address: clip(c.address, 500),
      postalCode: clip(c.postalCode, 20),
    };
    if (!guest.firstName || !guest.lastName || !guest.address || !guest.postalCode) {
      return NextResponse.json({ error: 'contact_required' }, { status: 400 });
    }
    if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    const verr = await checkVerificationCode(email, c.code);
    if (verr) return NextResponse.json({ error: verr }, { status: 400 });
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

  if (guest) {
    const { error: cErr } = await db.from('contact_requests').insert({
      name: `${guest.firstName} ${guest.lastName}`,
      first_name: guest.firstName,
      last_name: guest.lastName,
      email: guest.email,
      phone: guest.phone || null,
      address: guest.address,
      postal_code: guest.postalCode,
      message:
        `Havuz Teklif Talebi — ${config.length.toFixed(1)}×${config.width.toFixed(1)} m, ${formatPrice(ctx.breakdown.total, ctx.currency)} (${ctx.region})\n` +
        `Adres: ${guest.address}, ${guest.postalCode}\nE-posta doğrulandı.`,
    });
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
