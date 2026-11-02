import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redirectTo } from '@/lib/redirect';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  // Göreli yönlendirmede `//site.com` başka siteye gider; yalnızca site içi yollara izin ver
  const safeNext = /^\/(?![/\\])/.test(next) ? next : '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTo(safeNext);
    }
  }

  return redirectTo('/login?error=auth');
}
