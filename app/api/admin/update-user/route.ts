import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';

const adminClient = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function POST(req: NextRequest) {
  try {
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
