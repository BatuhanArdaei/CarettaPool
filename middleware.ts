import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { LANGUAGES } from '@/lib/i18n';

const LANG_CODES = new Set<string>(LANGUAGES.map((l) => l.code));
const DEFAULT_LANG = 'tr';

// Legacy flat routes → their /tr/ equivalents
const LEGACY: Record<string, string> = {
  '/urunler':    '/tr/urunler',
  '/iletisim':   '/tr/iletisim',
  '/galeri':     '/tr/galeri',
  '/kataloglar': '/tr/kataloglar',
  '/sss':        '/tr/sss',
  '/create':     '/tr/create',
  '/login':      '/tr/login',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always skip: assets, API, admin, auth
  const skip =
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/admin-panel') ||
    pathname.startsWith('/auth') ||
    pathname.includes('.');
  if (skip) return updateSession(request);

  // Already has a valid locale prefix → pass through
  const firstSeg = pathname.split('/')[1];
  if (LANG_CODES.has(firstSeg)) return updateSession(request);

  // Root → default locale home
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${DEFAULT_LANG}`, request.url));
  }

  // Known legacy paths
  const legacy = LEGACY[pathname];
  if (legacy) {
    return NextResponse.redirect(new URL(legacy, request.url));
  }

  // Anything else without a locale → prepend default
  return NextResponse.redirect(new URL(`/${DEFAULT_LANG}${pathname}`, request.url));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
