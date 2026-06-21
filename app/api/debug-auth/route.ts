import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null, userError: userError?.message });
  }

  const adminSupabase = createAdminClient();
  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles').select('*').eq('id', user.id).single();

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    profile,
    profileError: profileError?.message,
  });
}
