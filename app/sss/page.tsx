import { createClient } from '@/lib/supabase/server';
import T from '@/components/T';

export const metadata = { title: 'S.S.S — CarettaPool' };
export const revalidate = 60;

export default async function SssPage() {
  const supabase = createClient();
  const { data: faqs } = await supabase
    .from('faqs')
    .select('id, question, answer')
    .eq('published', true)
    .order('display_order')
    .order('created_at');

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Sıkça Sorulan Sorular
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          S.S.S
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">
          Aklınıza takılan sorulara hızlı cevaplar. Aradığınız sorunun yanıtı
          burada yoksa bize ulaşmaktan çekinmeyin.
        </p>

        {!faqs?.length ? (
          <p className="mt-12 text-slate-500">Henüz soru eklenmemiş.</p>
        ) : (
          <div className="mt-10 divide-y divide-slate-200 rounded-xl ring-1 ring-slate-200">
            {faqs.map((f) => (
              <details
                key={f.id}
                className="group p-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-slate-900">
                  {f.question}
                  <span className="text-brand-600 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {f.answer}
                </p>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
