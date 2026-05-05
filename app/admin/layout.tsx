import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from './AdminNav';

export const metadata = { title: 'Admin — CarettaPool' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/admin');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (profile?.role !== 'admin') redirect('/');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-4 px-6">
          <span className="text-base font-bold text-slate-900">CarettaPool Admin</span>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            <AdminNav />
          </nav>
          <a href="/" className="shrink-0 text-sm text-slate-500 hover:text-slate-800">← Siteye Dön</a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
