import GaleriGrid from './GaleriGrid';

export const metadata = { title: 'Galeri — CarettaPool' };

export default function GaleriPage() {
  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Tamamlanmış Projeler
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          Galeri
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">
          Bahçelerine ve yaşam alanlarına Caretta dokunduğumuz projelerden kareler.
        </p>

        <GaleriGrid />
      </section>
    </div>
  );
}
