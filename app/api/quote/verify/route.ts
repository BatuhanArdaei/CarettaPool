import { NextResponse, type NextRequest } from 'next/server';
import { normalizeEmail, sendVerificationCode } from '@/lib/emailVerification';

/** Teklif formu: e-posta adresine 6 haneli doğrulama kodu gönderir. */
export async function POST(request: NextRequest) {
  let body: { email?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const err = await sendVerificationCode(email, typeof body.lang === 'string' ? body.lang : 'tr');
  if (err) {
    const status = err === 'too_many_requests' ? 429 : err === 'email_unavailable' ? 503 : 400;
    return NextResponse.json({ error: err }, { status });
  }
  return NextResponse.json({ success: true });
}
