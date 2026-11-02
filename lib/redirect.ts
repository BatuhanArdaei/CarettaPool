import { NextResponse } from 'next/server';

/**
 * Göreli Location ile yönlendirir. Uygulama nginx arkasında 127.0.0.1:3001'de çalıştığından
 * request.url iç adresi taşır; mutlak adres üretmek ziyaretçiyi localhost'a gönderir.
 */
export function redirectTo(path: string, status = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}
