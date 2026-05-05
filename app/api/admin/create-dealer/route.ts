import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const adminClient = () =>
  createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is a logged-in admin before using service role
    const callerClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { company_name, email, password, full_name, discount_rate, discount_type, custom_prices } = await req.json();

    if (!company_name || !email || !password)
      return NextResponse.json({ error: 'Eksik alan' }, { status: 400 });

    const supabase = adminClient();

    // 1. Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || company_name },
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

    const userId = authData.user.id;

    // 2. Set profile role to dealer
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: full_name || company_name,
      role: 'dealer',
    });

    // 3. Create dealer record
    const { error: dealerErr } = await supabase.from('dealers').insert({
      user_id: userId,
      company_name,
      discount_rate: discount_rate ?? 0,
      discount_type: discount_type ?? 'percentage',
      custom_prices: custom_prices ?? {},
      is_active: true,
    });
    if (dealerErr) return NextResponse.json({ error: dealerErr.message }, { status: 400 });

    return NextResponse.json({ success: true, user_id: userId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
