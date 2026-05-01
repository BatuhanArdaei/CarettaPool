import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ConfiguratorClient from './components/ConfiguratorClient';

export const metadata = { title: 'Tasarla — CarettaPool' };

export default async function CreatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/create');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  return (
    <ConfiguratorClient
      userId={user.id}
      userEmail={user.email ?? ''}
      role={(profile?.role as 'customer' | 'dealer' | 'admin') ?? 'customer'}
      fullName={profile?.full_name ?? ''}
    />
  );
}
