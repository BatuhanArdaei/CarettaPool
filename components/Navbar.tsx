import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-700">CarettaPool</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/#urunler" className="text-slate-600 hover:text-brand-700">Ürünler</Link>
          <Link href="/#hakkimizda" className="text-slate-600 hover:text-brand-700">Hakkımızda</Link>
          <Link href="/#iletisim" className="text-slate-600 hover:text-brand-700">İletişim</Link>
          <Link href="/create" className="text-slate-600 hover:text-brand-700">Tasarla</Link>
          {role === 'admin' && (
            <Link href="/admin" className="text-slate-600 hover:text-brand-700">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <form action="/auth/signout" method="post">
              <button className="btn-outline" type="submit">Çıkış</button>
            </form>
          ) : (
            <Link href="/login" className="btn-outline">Giriş</Link>
          )}
          <Link href="/create" className="btn-primary hidden sm:inline-flex">
            Tasarımına Başla
          </Link>
        </div>
      </div>
    </header>
  );
}
