export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row">
        <p>© {new Date().getFullYear()} CarettaPool. Tüm hakları saklıdır.</p>
        <p>Hayalinizdeki havuz, gerçeğe dönüşüyor.</p>
      </div>
    </footer>
  );
}
