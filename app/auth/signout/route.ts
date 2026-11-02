import { createClient } from '@/lib/supabase/server';
import { redirectTo } from '@/lib/redirect';

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirectTo('/', 303);
}
