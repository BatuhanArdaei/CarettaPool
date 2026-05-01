import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatTRY } from '@/lib/pricing';
import type { Product } from '@/lib/types';

export const revalidate = 60;

export default async function HomePage() {
  const supabase = createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('base_price', { ascending: true })
    .limit(6);

  return (
    <div>
      <Hero />
      <Products products={(products as Product[]) ?? []} />
      <About />
      <Contact />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-cyan-50" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center md:py-28">
        <span className="rounded-full bg-brand-100 px-4 py-1 text-sm font-medium text-brand-700">
          3D Havuz Konfigüratörü
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold text-slate-900 md:text-6xl">
          Hayalinizdeki havuzu <span className="text-brand-600">kendiniz tasarlayın</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Boyutundan ışıklandırmasına, kaplamasından şelalesine kadar her detayı
          gerçek zamanlı 3D ortamda görerek seçin. Anında fiyat alın, teklif
          oluşturun.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/create" className="btn-primary px-6 py-3 text-base">
            Tasarımına Başla
          </Link>
          <Link href="#urunler" className="btn-outline px-6 py-3 text-base">
            Ürünleri İncele
          </Link>
        </div>
      </div>
    </section>
  );
}

function Products({ products }: { products: Product[] }) {
  return (
    <section id="urunler" className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Ürünlerimiz</h2>
        <p className="mt-2 text-slate-600">
          Modüler havuz çözümleri ve aksesuarlar.
        </p>
      </div>
      {products.length === 0 ? (
        <p className="text-center text-slate-500">
          Henüz ürün eklenmemiş. Admin panelinden ürün ekleyebilirsiniz.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="card p-6">
              <div className="mb-3 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {p.category}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-4 text-2xl font-bold text-brand-700">
                {formatTRY(p.base_price)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function About() {
  return (
    <section id="hakkimizda" className="bg-white py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Hakkımızda</h2>
          <p className="mt-4 leading-relaxed text-slate-600">
            CarettaPool, modern villa ve bahçeler için modüler havuz çözümleri
            üretir. Mühendislik, tasarım ve uygulama süreçlerinin tamamını
            tek elden yönetiyoruz. 3D konfigüratörümüz sayesinde
            müşterilerimiz havuzlarını üretim öncesinde gerçek zamanlı olarak
            görüp tüm detayları kendileri belirleyebiliyor.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ['10+', 'Yıllık deneyim'],
            ['350+', 'Tamamlanan proje'],
            ['Türkiye', 'Geneline uygulama'],
            ['2 yıl', 'Garanti süresi'],
          ].map(([n, l]) => (
            <li key={l} className="card p-6">
              <p className="text-3xl font-bold text-brand-700">{n}</p>
              <p className="mt-1 text-sm text-slate-600">{l}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="iletisim" className="mx-auto max-w-6xl px-4 py-16">
      <div className="card grid gap-6 p-8 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">İletişim</h2>
          <p className="mt-3 text-slate-600">
            Tasarımınız hakkında bilgi almak veya teklif istemek için bize ulaşın.
          </p>
          <div className="mt-6 space-y-2 text-sm text-slate-700">
            <p><strong>Telefon:</strong> +90 555 000 00 00</p>
            <p><strong>E-posta:</strong> info@carettapool.com</p>
            <p><strong>Adres:</strong> İstanbul, Türkiye</p>
          </div>
        </div>
        <form className="grid gap-3">
          <div>
            <label className="label" htmlFor="name">Adınız</label>
            <input id="name" name="name" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="email">E-posta</label>
            <input id="email" name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="msg">Mesajınız</label>
            <textarea id="msg" name="msg" rows={4} className="input" />
          </div>
          <button type="button" className="btn-primary">Gönder</button>
        </form>
      </div>
    </section>
  );
}
