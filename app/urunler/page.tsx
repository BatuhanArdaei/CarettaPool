import Link from 'next/link';
import Image from 'next/image';
import {
  POOL_PRODUCTS,
  formatDimensions,
  getProductSpecs,
  type PoolProduct,
} from '@/lib/products-catalog';

export const metadata = {
  title: 'Ürünler — CarettaPool',
  description:
    'Caretta havuz paketleri — Antalya, Malta, Creta, Bali, Cuba, Rio. Modüler havuz çözümleri.',
};

export default function UrunlerPage() {
  return (
    <div className="bg-white">
      {/* Page intro */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Caretta Havuz Paketleri
        </p>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          Kendinizi havuz başında, güneşin tadını çıkarırken ve kendi
          havuzunuzun huzurunun tadını çıkarırken hayal edin.
        </h1>
        <p className="mt-6 text-base text-slate-500">
          Caretta Pool ile bu hayal artık gerçek oluyor. Farklı paketlerimizi
          inceleyin ve en iyi seçeneği bulun.
        </p>
      </section>

      {/* Product list */}
      <div className="mx-auto max-w-6xl px-6 pb-24">
        {POOL_PRODUCTS.map((p, i) => (
          <ProductRow key={p.slug} product={p} reverse={i % 2 === 1} />
        ))}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  reverse,
}: {
  product: PoolProduct;
  reverse: boolean;
}) {
  const specs = getProductSpecs(product);
  return (
    <article
      className={`grid items-center gap-10 border-t border-slate-100 py-16 first:border-t-0 md:grid-cols-2 md:py-20 ${
        reverse ? 'md:[&>div:first-child]:order-2' : ''
      }`}
    >
      <div className="flex justify-center">
        <div className="relative aspect-[4/3] w-full max-w-md">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 480px"
            className="object-contain"
          />
        </div>
      </div>

      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Caretta Pool
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          {product.name}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {formatDimensions(product)}
        </p>

        <ul className="mt-6 list-disc space-y-1.5 pl-5 text-sm text-slate-600 marker:text-slate-400">
          {specs.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>

        <Link
          href="/create"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-brand-500 px-6 py-3 text-sm font-medium text-white underline-offset-4 transition-colors hover:bg-brand-400 hover:underline"
        >
          Kendiniz Havuzunuzu Yaratın
        </Link>
      </div>
    </article>
  );
}
