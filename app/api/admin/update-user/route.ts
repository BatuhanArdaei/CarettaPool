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
    const callerClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { user_id, password, ban } = await req.json();
    if (!user_id) return NextResponse.json({ error: 'user_id gerekli' }, { status: 400 });

    const supabase = adminClient();
    const updates: Record<string, unknown> = {};

    if (password) updates.password = password;
    if (typeof ban === 'boolean') updates.ban_duration = ban ? '876600h' : 'none'; // ban ~100 years or lift

    const { error } = await supabase.auth.admin.updateUserById(user_id, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
