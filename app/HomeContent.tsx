'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { POOL_PRODUCTS, formatDimensions } from '@/lib/products-catalog';

export default function HomeContent() {
  const { t } = useLanguage();

  return (
    <div>
      {/* Process steps */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:gap-6 sm:px-6 sm:grid-cols-2 md:grid-cols-3">
          {[
            { n: '01', title: t('home.process_1_title'), text: t('home.process_1_desc') },
            { n: '02', title: t('home.process_2_title'), text: t('home.process_2_desc') },
            { n: '03', title: t('home.process_3_title'), text: t('home.process_3_desc') },
          ].map((s) => (
            <div key={s.n} className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 md:p-8">
              <span className="text-5xl font-extrabold text-brand-100">{s.n}</span>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Biz Kimiz */}
      <section className="bg-white py-20 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t('home.bizkimiz_tag')}</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{t('home.bizkimiz_title')}</h2>
            <p className="mt-6 max-w-lg text-slate-500">{t('home.bizkimiz_desc')}</p>
            <Link href="/urunler" className="mt-8 inline-flex items-center justify-center rounded-md bg-brand-500 px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-400">
              {t('home.bizkimiz_cta')}
            </Link>
          </div>
          <div className="relative aspect-square w-full">
            <Image src="/simitli_yuzen_kadin.png" alt="Caretta Pool" fill sizes="(max-width: 768px) 100vw, 540px" className="object-contain" />
          </div>
        </div>
      </section>

      {/* Neden Biz */}
      <section className="bg-white py-20 md:py-24">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-6 md:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md">
              <Image src="/neden_biz_main.png" alt="Caretta" fill sizes="(max-width: 768px) 100vw, 540px" className="object-cover" />
            </div>
            <div className="absolute -bottom-6 left-6 rounded-md bg-white p-6 ring-1 ring-slate-200 shadow-lg md:left-[-32px]">
              <p className="text-4xl font-extrabold text-brand-500">15+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">{t('home.nedenbiz_exp')}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t('home.nedenbiz_tag')}</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">{t('home.nedenbiz_title')}</h2>
            <p className="mt-5 text-sm text-slate-500">{t('home.nedenbiz_desc')}</p>
            <div className="mt-8 space-y-7">
              {[
                { title: t('home.ozellestime'), text: t('home.ozellestime_desc'), icon: '💡' },
                { title: t('home.mobilite'),    text: t('home.mobilite_desc'),    icon: '🔄' },
                { title: t('home.satis_sonrasi'), text: t('home.satis_sonrasi_desc'), icon: '🎧' },
              ].map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xl">{f.icon}</div>
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wide text-slate-900">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Degerlerimiz */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0">
          <Image src="/havuz-gunduz-yakın-cekim-1.jpg" alt="" fill sizes="100vw" className="object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-slate-900/55" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">{t('home.degerler_tag')}</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">{t('home.degerler_title')}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/80">{t('home.degerler_desc')}</p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 sm:grid-cols-2 md:grid-cols-3">
            {[
              { title: t('home.moduler'), text: t('home.moduler_desc') },
              { title: t('home.zahmetsiz'), text: t('home.zahmetsiz_desc') },
              { title: t('home.benzersiz'), text: t('home.benzersiz_desc') },
            ].map((v) => (
              <div key={v.title} className="flex flex-col items-center rounded-md bg-white p-8 text-center shadow-md ring-1 ring-slate-200">
                <h3 className="mt-5 text-base font-bold tracking-wide text-slate-900">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products teaser */}
      <section id="urunler" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{t('home.products_tag')}</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">{t('home.products_title')}</h2>
            <p className="mt-3 text-sm text-slate-500">{t('home.products_desc')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {POOL_PRODUCTS.map((p) => (
              <div key={p.slug} className="group overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-slate-50">
                  <Image src={p.image} alt={p.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain p-6 transition-transform group-hover:scale-105" />
                </div>
                <div className="border-t border-slate-100 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Caretta Pool</p>
                  <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{p.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{formatDimensions(p)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/urunler" className="inline-flex items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:text-brand-700">
              {t('home.products_cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="iletisim" className="bg-white py-20">
        <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-14 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold md:text-4xl">{t('home.cta_title')}</h2>
          <p className="mt-4 text-white/85">{t('home.cta_desc')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/create" className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-medium text-brand-700 transition-colors hover:bg-slate-100">
              {t('home.cta_btn')}
            </Link>
            <Link href="/iletisim" className="inline-flex items-center justify-center rounded-md border border-white/40 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">
              {t('home.cta_contact')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
