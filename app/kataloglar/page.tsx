import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Kataloglar — CarettaPool' };
export const revalidate = 60;

export default async function KataloglarPage() {
  const supabase = createClient();
  const { data: catalogs } = await supabase
    .from('catalogs')
    .select('id, language, flag, file_url, title')
    .eq('published', true)
    .order('created_at', { ascending: false });

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Dokümanlar
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          Kataloglar
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">
          Caretta havuz modellerimiz ve teknik şartnameleri PDF olarak
          görüntüleyebilirsiniz.
        </p>

        {!catalogs?.length ? (
          <p className="mt-12 text-slate-500">Henüz katalog eklenmemiş.</p>
        ) : (
          <div className="mt-12 flex max-w-2xl flex-col gap-4">
            {catalogs.map((c) => (
              <div
                key={c.id}
                className="flex gap-6 overflow-hidden rounded-xl ring-1 ring-slate-200 transition-shadow hover:shadow-md"
              >
                {/* Flag */}
                <div className="flex w-36 shrink-0 items-center justify-center bg-slate-50 py-6 text-5xl">
                  {c.flag || '📄'}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-center gap-2 py-5 pr-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{c.language}</p>
                  <h3 className="text-lg font-bold text-slate-900">
                    {(c as any).title || c.language}
                  </h3>
                  <Link
                    href={c.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit rounded-md bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
                  >
                    ÖNİZLEME
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
