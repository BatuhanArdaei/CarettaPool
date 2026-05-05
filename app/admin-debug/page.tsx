import { createClient } from '@/lib/supabase/server';

export default async function DebugPage() {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (session?.user?.id) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    profile = data;
  }

  return (
    <div className="p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Debug</h1>
      <pre className="bg-slate-100 p-4 rounded">
{JSON.stringify({
  hasSession: !!session,
  sessionUserId: session?.user?.id,
  sessionEmail: session?.user?.email,
  hasUser: !!user,
  userEmail: user?.email,
  profile
}, null, 2)}
      </pre>
    </div>
  );
}
