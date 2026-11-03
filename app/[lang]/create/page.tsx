import { createClient } from '@/lib/supabase/server';
import { dealerRegionOf } from '@/lib/priceServer';
import ConfiguratorClient from '@/app/create/components/ConfiguratorClient';
import BayiPopup from '@/components/BayiPopup';
import { pageAlternates } from '@/lib/site';

export function generateMetadata({ params }: { params: { lang: string } }) {
  return { title: 'Tasarla — CarettaPool', alternates: pageAlternates(params.lang, 'create') };
}

export default async function LangCreatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();
    profile = data;
  }
  const dealerRegion = user && profile?.role === 'dealer' ? await dealerRegionOf(supabase, user.id) : null;

  return (
    <>
      {!user && <BayiPopup />}
      <ConfiguratorClient
        userId={user?.id ?? ''}
        userEmail={user?.email ?? ''}
        role={(profile?.role as 'customer' | 'dealer' | 'admin') ?? 'customer'}
        fullName={profile?.full_name ?? ''}
        dealerRegion={dealerRegion}
      />
    </>
  );
}
