import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      {/* Pool icon */}
      <svg
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-8 w-40 text-brand-400 opacity-80"
        aria-hidden="true"
      >
        {/* Pool body */}
        <rect x="4" y="20" width="112" height="52" rx="6" fill="#0e7490" opacity="0.2" stroke="currentColor" strokeWidth="2.5" />
        {/* Water waves */}
        <path
          d="M4 48 Q19 40 34 48 Q49 56 64 48 Q79 40 94 48 Q109 56 116 48"
          stroke="#22d3ee"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M4 56 Q19 48 34 56 Q49 64 64 56 Q79 48 94 56 Q109 64 116 56"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        {/* Ladder left */}
        <line x1="18" y1="20" x2="18" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="28" y1="20" x2="28" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="16" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* 404 text inside pool */}
        <text x="60" y="38" textAnchor="middle" fill="#22d3ee" fontSize="14" fontWeight="bold" fontFamily="monospace">404</text>
      </svg>

      <h1 className="text-2xl font-bold text-white sm:text-3xl">
        Aradığınız Sayfaya Ulaşılamıyor
      </h1>
      <p className="mt-3 max-w-sm text-sm text-slate-400">
        Bu sayfa mevcut değil ya da taşınmış olabilir. Ana sayfaya dönerek gezinmeye devam edebilirsiniz.
      </p>

      <Link
        href="/tr"
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-400"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
