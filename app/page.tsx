import Link from 'next/link';
import Image from 'next/image';
import HeroSlider from '@/components/HeroSlider';
import AnimateOnScroll from '@/components/AnimateOnScroll';
import {
  POOL_PRODUCTS,
  formatDimensions,
} from '@/lib/products-catalog';

export const metadata = {
  title: 'CarettaPool — Yenilikçi Modüler Havuzlar',
  description:
    'Lüks modüler Caretta havuzları. 3D konfigüratörümüzle havuzunuzu kendiniz tasarlayın.',
};

export default function HomePage() {
  return (
    <div>
      <HeroSlider />
      <ProcessSteps />
      <BizKimiz />
      <NedenBiz />
      <Degerlerimiz />
      <ProductsTeaser />
      <ContactCTA />
    </div>
  );
}

function ProcessSteps() {
  const steps = [
    {
      n: '01',
      title: 'Havuzunuzu Tasarlayın',
      text: 'Boyut, panel, ışıklandırma, kaplama ve şelaleyi 3D konfigüratörde anlık görerek seçin.',
    },
    {
      n: '02',
      title: 'Teklif Alın',
      text: 'Onayladığınız konfigürasyonu kaydedin, uzman ekibimiz en kısa sürede size özel teklif ile ulaşsın.',
    },
    {
      n: '03',
      title: 'Kurulum ve Teslim',
      text: 'Modüler yapı sahanıza taşınır, kısa sürede kullanıma hazır hale gelir.',
    },
  ];
  return (
    <section className="bg-slate-50 py-20">
      <AnimateOnScroll stagger={120} className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="relative overflow-hidden rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
          >
            <span className="text-5xl font-extrabold text-brand-100">{s.n}</span>
            <h3 className="mt-2 text-xl font-bold text-slate-900">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.text}</p>
          </div>
        ))}
      </AnimateOnScroll>
    </section>
  );
}

function BizKimiz() {
  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2" >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Biz Kimiz
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
            Caretta Pool&apos;un Tasarladığı Portatif Havuzların Dünyasına Hoş
            Geldiniz.
          </h2>
          <p className="mt-6 max-w-lg text-slate-500">
            Taşınabilir havuzların işlevselliğini özel bir yüzme vahasının
            cazibesiyle birleştirerek sizi su lüksünün yepyeni bir düzeyiyle
            tanıştırmaktan heyecan duyuyoruz.
          </p>
          <Link
            href="/urunler"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-brand-500 px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-400"
          >
            Daha Fazla Bilgi
          </Link>
        </div>
        <div className="relative aspect-square w-full">
          <Image
            src="/simitli_yuzen_kadin.png"
            alt="Caretta havuzunda simit ile yüzen kadın"
            fill
            sizes="(max-width: 768px) 100vw, 540px"
            className="object-contain"
            priority={false}
          />
        </div>
      </div>
    </section>
  );
}

function NedenBiz() {
  const features = [
    {
      title: 'Özelleştirme',
      text: 'Havuzunuz kişiliğinizi yansıtmalıdır. Havuzunuzu benzersiz bir başyapıt haline getirmek için geniş renk ve tasarım seçenekleri arasından seçim yapabilirsiniz.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path
            d="M9 18h6m-3-12a6 6 0 0 0-3.6 10.8c.4.3.6.7.6 1.2v.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-.5c0-.5.2-.9.6-1.2A6 6 0 0 0 12 6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: 'Mobilite',
      text: 'Havuzlarımız mobilite düşünülerek tasarlanmıştır. Taşınacak olursanız havuzunuzu da yanınıza alabilir ve sağladığı lüksün keyfini çıkarmaya devam edebilirsiniz.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path
            d="M4 14a8 8 0 1 1 16 0v3H4v-3Zm2-1h12M9 9l1.5 4M15 9l-1.5 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: 'Satış Sonrası Hizmetler',
      text: 'Havuzunuzun yıllar boyu keyif kaynağı olarak kalmasını sağlamak için özel destek ve kapsamlı satış sonrası hizmetler sunuyoruz.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path
            d="M5 12a7 7 0 0 1 14 0m-1 5h-2v-4h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1Zm-12 0H8v-4H6a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1Zm12 0v1a3 3 0 0 1-3 3h-1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-6 md:grid-cols-2">
        {/* Left: image with deneyim badge */}
        <div className="relative">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md">
            <Image
              src="/neden_biz_main.png"
              alt="Caretta havuzunda yüzen kadın"
              fill
              sizes="(max-width: 768px) 100vw, 540px"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-6 left-6 rounded-md bg-white p-6 ring-1 ring-slate-200 shadow-lg md:left-[-32px]">
            <p className="text-4xl font-extrabold text-brand-500">15+</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              Yıllık Deneyim
            </p>
          </div>
        </div>

        {/* Right: features */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Neden Biz
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
            Boş zamanlarınızı yeniden tanımlamak ve yenilikçi tasarımı kapınıza
            kadar getirmek için buradayız.
          </h2>
          <p className="mt-5 text-sm text-slate-500">
            Lüks ve sürdürülebilirliğin sorunsuz bir şekilde birleştiği bir
            dünya yaratmak için bize katılın.
          </p>

          <div className="mt-8 space-y-7">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-base font-bold uppercase tracking-wide text-slate-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {f.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Degerlerimiz() {
  const values = [
    {
      title: 'MODÜLER TASARIM',
      text: 'Tasarım havuzlarımız, 2.20 ile 4 metre arası genişlik ve 3 ile 12 metre arasında değişen uzunluklarıyla inanılmaz derecede çok yönlüdür ve ister kompakt bir arka bahçe, ister genişleyen bir çatı katı olsun, alanınıza mükemmel şekilde uyum sağlamalarını sağlar.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
          <path
            d="M12 4a6 6 0 0 0-3 11.2V18a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.8A6 6 0 0 0 12 4Zm-1 17h2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: 'ZAHMETSİZ KURULUM',
      text: 'Hiçbir inşaat veya temel işi gerekmediği için havuzunuzu kurmak zahmetsiz ve kolaydır. Geleneksel havuz inşaatıyla ilgili karmaşıklıkları ortadan kaldırdık.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
          <path
            d="M4 20V9l8-5 8 5v11M9 20v-6h6v6M3 20h18"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: 'BENZERSİZ PAKETLER',
      text: 'Tarzınıza ve çevrenize en uygun estetiği seçmenize olanak tanıyan çok çeşitli kaplama paketleri sunuyoruz.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
          <path
            d="M12 2v4M12 6c-4 0-8 3-8 7M12 6c4 0 8 3 8 7M12 6c-2 0-4 3-4 7M12 6c2 0 4 3 4 7M4 13h16M12 13v9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      {/* Background image + overlay */}
      <div className="absolute inset-0">
        <Image
          src="/havuz-gunduz-yakın-cekim-1.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-slate-900/55" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
            Değerlerimiz
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
            Caretta Pools ile yüzme havuzlarının geleceğini keşfedin!
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/80">
            Kişisel havuz hayalinizin kullanışlı ve çevre dostu olması
            gerektiğine inanıyoruz.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {values.map((v) => (
            <div
              key={v.title}
              className="flex flex-col items-center rounded-md bg-white p-8 text-center shadow-md ring-1 ring-slate-200"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                {v.icon}
              </div>
              <h3 className="mt-5 text-base font-bold tracking-wide text-slate-900">
                {v.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {v.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductsTeaser() {
  return (
    <section id="urunler" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            Caretta Havuz Paketleri
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
            Modellerimiz
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Her boyut için bir çözüm. Tümünü inceleyin.
          </p>
        </div>
        <AnimateOnScroll stagger={80} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {POOL_PRODUCTS.map((p) => (
            <div
              key={p.slug}
              className="group overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] bg-slate-50">
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-contain p-6 transition-transform group-hover:scale-105"
                />
              </div>
              <div className="border-t border-slate-100 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
                  Caretta Pool
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {p.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDimensions(p)}
                </p>
              </div>
            </div>
          ))}
        </AnimateOnScroll>
        <div className="mt-12 text-center">
          <Link
            href="/urunler"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:text-brand-700"
          >
            Tüm Ürünleri İncele
          </Link>
        </div>
      </div>
    </section>
  );
}

function ContactCTA() {
  return (
    <section id="iletisim" className="bg-white py-20">
      <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-14 text-center text-white shadow-xl">
        <h2 className="text-3xl font-bold md:text-4xl">
          Havuzunuzu bugün tasarlamaya başlayın
        </h2>
        <p className="mt-4 text-white/85">
          Konfigüratörü açın, dakikalar içinde havuzunuzu kendiniz oluşturun.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/create"
            className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-medium text-brand-700 transition-colors hover:bg-slate-100"
          >
            Havuzunu Oluştur
          </Link>
          <Link
            href="/iletisim"
            className="inline-flex items-center justify-center rounded-md border border-white/40 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Bize Ulaşın
          </Link>
        </div>
      </div>
    </section>
  );
}
