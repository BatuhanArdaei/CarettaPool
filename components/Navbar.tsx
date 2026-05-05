import { createClient } from '@/lib/supabase/server';
import NavbarClient from './NavbarClient';

export default async function Navbar() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    role = data?.role ?? null;
  }

  return <NavbarClient isAuthenticated={Boolean(user)} role={role} />;
}
