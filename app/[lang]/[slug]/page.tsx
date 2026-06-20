import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { SLUG_MAP, localePath } from '@/lib/i18n/routes';
import { getMessages, createT } from '@/lib/i18n/server';
import { POOL_PRODUCTS, formatDimensions, getProductSpecItems } from '@/lib/products-catalog';
import GaleriGrid from '@/app/galeri/GaleriGrid';
import ContactForm from '@/app/iletisim/ContactForm';
import type { LangCode } from '@/lib/i18n';
import type { PoolProduct } from '@/lib/products-catalog';

export const revalidate = 60;

type Props = { params: { lang: string; slug: string } };

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = params;
  const pageKey = SLUG_MAP[lang]?.[slug];
  if (!pageKey) return {};
  const msgs = await getMessages(lang as LangCode);
  const t = createT(msgs);
  const titles: Record<string, string> = {
    products: `${t('nav.products')} — CarettaPool`,
    contact:  `${t('contact.title')} — CarettaPool`,
    gallery:  `${t('gallery.title')} — CarettaPool`,
    catalogs: `${t('catalog.title')} — CarettaPool`,
    faq:      `${t('faq.title')} — CarettaPool`,
  };
  return { title: titles[pageKey] ?? 'CarettaPool' };
}

// ─── Products ────────────────────────────────────────────────────────────────

function ProductsPage({ lang, t }: { lang: string; t: (k: string) => string }) {
  return (
    <div className="bg-white">
      <section className="mx-auto max-w-4xl px-6 py-16 text-center md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          {t('home.products_tag')}
        </p>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          {t('products.heading')}
        </h1>
        <p className="mt-6 text-base text-slate-500">{t('products.desc')}</p>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-24">
        {POOL_PRODUCTS.map((p, i) => (
          <ProductRow key={p.slug} product={p} reverse={i % 2 === 1} lang={lang} t={t} />
        ))}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  reverse,
  lang,
  t,
}: {
  product: PoolProduct;
  reverse: boolean;
  lang: string;
  t: (k: string) => string;
}) {
  const specItems = getProductSpecItems(product);
  return (
    <article
      className={`grid items-center gap-6 border-t border-slate-100 py-10 first:border-t-0 sm:gap-10 md:grid-cols-2 md:py-20 ${
        reverse ? 'md:[&>div:first-child]:order-2' : ''
      }`}
    >
      <div className="flex justify-center">
        <div className="relative aspect-[4/3] w-full max-w-md">
          <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 480px" className="object-contain" />
        </div>
      </div>
      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Caretta Pool</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{product.name}</h2>
        <p className="mt-2 text-sm text-slate-500">{formatDimensions(product)}</p>
        <ul className="mt-6 list-disc space-y-1.5 pl-5 text-sm text-slate-600 marker:text-slate-400">
          {specItems.map((item, i) => (
            <li key={i}>{t(item.key).replace('{n}', String(item.n ?? ''))}</li>
          ))}
        </ul>
        <Link
          href={localePath(lang, 'create')}
          className="mt-8 inline-flex items-center justify-center rounded-md bg-brand-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-400"
        >
          {t('products.cta')}
        </Link>
      </div>
    </article>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

interface ContactSettings { phones?: string[]; email?: string; address?: string }

async function ContactPage({ t }: { t: (k: string) => string }) {
  const supabase = createClient();
  const { data } = await supabase.from('site_settings').select('key, value').in('key', ['contact']);
  const contact: ContactSettings = (data?.find((r) => r.key === 'contact')?.value as ContactSettings) ?? {};

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">{t('contact.subtitle')}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{t('contact.title')}</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">{t('contact.description')}</p>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            {contact.phones?.length ? (
              <InfoBlock label={t('contact.phone')}>
                {contact.phones.filter(Boolean).map((p) => (
                  <a key={p} href={`tel:${p.replace(/\s/g, '')}`} className="block text-base font-medium text-slate-900 hover:text-brand-600">{p}</a>
                ))}
              </InfoBlock>
            ) : null}
            {contact.email && (
              <InfoBlock label={t('contact.email')}>
                <a href={`mailto:${contact.email}`} className="text-base font-medium text-slate-900 hover:text-brand-600">{contact.email}</a>
              </InfoBlock>
            )}
            {contact.address && (
              <InfoBlock label={t('contact.address')}>
                <p className="text-base font-medium text-slate-900 whitespace-pre-line">{contact.address}</p>
              </InfoBlock>
            )}
          </div>
          <ContactForm />
        </div>
      </section>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

function GalleryPage({ t }: { t: (k: string) => string }) {
  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">{t('gallery.subtitle')}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{t('gallery.title')}</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">{t('gallery.description')}</p>
        <GaleriGrid />
      </section>
    </div>
  );
}

// ─── Catalogs ────────────────────────────────────────────────────────────────

async function CatalogsPage({ t }: { t: (k: string) => string }) {
  const supabase = createClient();
  const { data: catalogs } = await supabase
    .from('catalogs').select('id, language, flag, file_url, title')
    .eq('published', true).order('created_at', { ascending: false });

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">{t('catalog.subtitle')}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{t('catalog.title')}</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">{t('catalog.description')}</p>
        {!catalogs?.length ? (
          <p className="mt-12 text-slate-500">{t('catalog.empty')}</p>
        ) : (
          <div className="mt-12 flex max-w-2xl flex-col gap-4">
            {catalogs.map((c) => (
              <div key={c.id} className="flex flex-col gap-4 overflow-hidden rounded-xl ring-1 ring-slate-200 transition-shadow hover:shadow-md sm:flex-row sm:gap-6">
                <div className="flex h-32 w-full items-center justify-center bg-slate-50 text-5xl sm:h-auto sm:w-32">{c.flag || '📄'}</div>
                <div className="flex flex-1 flex-col justify-center gap-2 py-5 pr-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{c.language}</p>
                  <h3 className="text-lg font-bold text-slate-900">{(c as any).title || c.language}</h3>
                  <Link href={c.file_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex w-fit rounded-md bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400">
                    {t('catalog.preview')}
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

// ─── FAQ ─────────────────────────────────────────────────────────────────────

async function FaqPage({ t }: { t: (k: string) => string }) {
  const supabase = createClient();
  const { data: faqs } = await supabase.from('faqs').select('id, question, answer')
    .eq('published', true).order('display_order').order('created_at');

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">{t('faq.subtitle')}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{t('faq.title')}</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">{t('faq.description')}</p>
        {!faqs?.length ? (
          <p className="mt-12 text-slate-500">{t('faq.empty')}</p>
        ) : (
          <div className="mt-10 divide-y divide-slate-200 rounded-xl ring-1 ring-slate-200">
            {faqs.map((f) => (
              <details key={f.id} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-slate-900">
                  {f.question}
                  <span className="text-brand-600 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function SlugPage({ params }: Props) {
  const { lang, slug } = params;
  const pageKey = SLUG_MAP[lang]?.[slug];
  if (!pageKey || pageKey === 'login') notFound();

  const msgs = await getMessages(lang as LangCode);
  const t = createT(msgs);

  switch (pageKey) {
    case 'products': return <ProductsPage lang={lang} t={t} />;
    case 'contact':  return <ContactPage t={t} />;
    case 'gallery':  return <GalleryPage t={t} />;
    case 'catalogs': return <CatalogsPage t={t} />;
    case 'faq':      return <FaqPage t={t} />;
    default:         notFound();
  }
}
