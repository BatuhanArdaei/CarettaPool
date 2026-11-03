import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { LANGUAGES } from '@/lib/i18n';
import { DEFAULT_LANG } from '@/lib/site';

const LANG_CODES = new Set<string>(LANGUAGES.map((l) => l.code));

// Eski sitenin ve dil öneksiz adreslerin yeni karşılıkları (kalıcı yönlendirme)
const LEGACY: Record<string, string> = {
  '/':           '/tr',
  '/anasayfa':   '/tr',
  '/products':   '/en/products',
  '/contact':    '/en/contact',
  '/gallery':    '/en/gallery',
  '/catalogs':   '/en/catalogs',
  '/faq':        '/en/faq',
  '/urunler':    '/tr/urunler',
  '/iletisim':   '/tr/iletisim',
  '/galeri':     '/tr/galeri',
  '/kataloglar': '/tr/kataloglar',
  '/sss':        '/tr/sss',
  '/create':     '/tr/create',
  '/login':      '/tr/login',
};

// Sunucuda uygulama nginx arkasında 127.0.0.1:3001'de çalışır ve request.url `localhost:3001` taşır.
// Middleware mutlak adres istediğinden adresi ziyaretçinin geldiği Host başlığından kurarız.
function redirectTo(path: string, request: NextRequest, status: 307 | 308) {
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' ? 'https' : 'http';
  const url = new URL(path, `${proto}://${host}`);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url, status);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always skip: assets, API, admin, auth
  const skip =
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.includes('.');
  if (skip) return updateSession(request);

  // Already has a valid locale prefix → pass through
  const firstSeg = pathname.split('/')[1];
  if (LANG_CODES.has(firstSeg)) return updateSession(request);

  // Known legacy paths
  const legacy = LEGACY[pathname];
  if (legacy) {
    return redirectTo(legacy, request, 308);
  }

  // Bilinmeyen adresler: hedef 404 olabileceğinden kalıcı yönlendirme verme
  return redirectTo(`/${DEFAULT_LANG}${pathname}`, request, 307);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
