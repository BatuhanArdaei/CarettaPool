import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Teklif formu için e-posta doğrulama: 6 haneli kod Resend ile noreply@carettapool.com
 * adresinden gönderilir. Kod yalnızca HMAC özeti olarak saklanır (email_verifications).
 */

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;
const MAX_PER_HOUR = 5;

export type VerifyError =
  | 'invalid_email'
  | 'email_unavailable'
  | 'too_many_requests'
  | 'send_failed'
  | 'invalid_code'
  | 'code_expired';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 200 && EMAIL_RE.test(e) ? e : null;
}

function hashCode(email: string, code: string): string {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY ?? 'caretta').update(`${email}:${code}`).digest('hex');
}

const MAIL: Record<string, { subject: string; body: (code: string) => string }> = {
  tr: { subject: 'Caretta Pool doğrulama kodunuz', body: (c) => `Teklif talebinizi tamamlamak için doğrulama kodunuz: ${c}\n\nKod ${CODE_TTL_MIN} dakika geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.` },
  en: { subject: 'Your Caretta Pool verification code', body: (c) => `Your verification code to complete your quote request: ${c}\n\nThe code is valid for ${CODE_TTL_MIN} minutes. If you did not make this request, you can ignore this email.` },
  de: { subject: 'Ihr Caretta Pool Bestätigungscode', body: (c) => `Ihr Bestätigungscode für Ihre Angebotsanfrage: ${c}\n\nDer Code ist ${CODE_TTL_MIN} Minuten gültig. Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.` },
  fr: { subject: 'Votre code de vérification Caretta Pool', body: (c) => `Votre code de vérification pour finaliser votre demande de devis : ${c}\n\nLe code est valable ${CODE_TTL_MIN} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.` },
  es: { subject: 'Tu código de verificación de Caretta Pool', body: (c) => `Tu código de verificación para completar la solicitud de presupuesto: ${c}\n\nEl código es válido durante ${CODE_TTL_MIN} minutos. Si no hiciste esta solicitud, ignora este correo.` },
  it: { subject: 'Il tuo codice di verifica Caretta Pool', body: (c) => `Il tuo codice di verifica per completare la richiesta di preventivo: ${c}\n\nIl codice è valido per ${CODE_TTL_MIN} minuti. Se non hai fatto tu questa richiesta, ignora questa e-mail.` },
  pt: { subject: 'O seu código de verificação Caretta Pool', body: (c) => `O seu código de verificação para concluir o pedido de orçamento: ${c}\n\nO código é válido durante ${CODE_TTL_MIN} minutos. Se não fez este pedido, ignore este e-mail.` },
  nl: { subject: 'Uw Caretta Pool verificatiecode', body: (c) => `Uw verificatiecode om uw offerteaanvraag af te ronden: ${c}\n\nDe code is ${CODE_TTL_MIN} minuten geldig. Heeft u deze aanvraag niet gedaan, negeer deze e-mail dan.` },
  da: { subject: 'Din Caretta Pool bekræftelseskode', body: (c) => `Din bekræftelseskode til at fuldføre din tilbudsanmodning: ${c}\n\nKoden er gyldig i ${CODE_TTL_MIN} minutter. Hvis du ikke har foretaget denne anmodning, kan du se bort fra denne e-mail.` },
  no: { subject: 'Din Caretta Pool bekreftelseskode', body: (c) => `Din bekreftelseskode for å fullføre tilbudsforespørselen: ${c}\n\nKoden er gyldig i ${CODE_TTL_MIN} minutter. Hvis du ikke sendte denne forespørselen, kan du se bort fra denne e-posten.` },
  pl: { subject: 'Twój kod weryfikacyjny Caretta Pool', body: (c) => `Twój kod weryfikacyjny do zakończenia zapytania ofertowego: ${c}\n\nKod jest ważny przez ${CODE_TTL_MIN} minut. Jeśli to nie Ty wysłałeś zapytanie, zignoruj tę wiadomość.` },
  ro: { subject: 'Codul tău de verificare Caretta Pool', body: (c) => `Codul tău de verificare pentru a finaliza cererea de ofertă: ${c}\n\nCodul este valabil ${CODE_TTL_MIN} minute. Dacă nu ai făcut această cerere, ignoră acest e-mail.` },
  lt: { subject: 'Jūsų Caretta Pool patvirtinimo kodas', body: (c) => `Jūsų patvirtinimo kodas pasiūlymo užklausai užbaigti: ${c}\n\nKodas galioja ${CODE_TTL_MIN} min. Jei šios užklausos nepateikėte, ignoruokite šį laišką.` },
  el: { subject: 'Ο κωδικός επαλήθευσης Caretta Pool', body: (c) => `Ο κωδικός επαλήθευσης για να ολοκληρώσετε το αίτημα προσφοράς: ${c}\n\nΟ κωδικός ισχύει για ${CODE_TTL_MIN} λεπτά. Αν δεν κάνατε εσείς αυτό το αίτημα, αγνοήστε αυτό το email.` },
  ar: { subject: 'رمز التحقق من Caretta Pool', body: (c) => `رمز التحقق لإكمال طلب عرض السعر: ${c}\n\nالرمز صالح لمدة ${CODE_TTL_MIN} دقيقة. إذا لم تقم بهذا الطلب، يمكنك تجاهل هذه الرسالة.` },
};

/** Yeni kod üretir, kaydeder ve Resend ile gönderir. */
export async function sendVerificationCode(email: string, lang: string): Promise<VerifyError | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return 'email_unavailable';

  const db = createAdminClient();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent, error: qErr } = await db
    .from('email_verifications')
    .select('created_at')
    .eq('email', email)
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false });
  if (qErr) return 'send_failed';
  if (recent && recent.length >= MAX_PER_HOUR) return 'too_many_requests';
  if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_SEC * 1000) {
    return 'too_many_requests';
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { error: iErr } = await db.from('email_verifications').insert({
    email,
    code_hash: hashCode(email, code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
  });
  if (iErr) return 'send_failed';

  const mail = MAIL[lang] ?? MAIL.en;
  const text = mail.body(code);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.5">
<p>${text.split('\n\n')[0].replace(code, `<strong style="font-size:22px;letter-spacing:4px">${code}</strong>`)}</p>
<p style="color:#64748b;font-size:13px">${text.split('\n\n')[1]}</p>
<p style="color:#94a3b8;font-size:12px">Caretta Pool</p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Caretta Pool <noreply@carettapool.com>',
      to: [email],
      subject: mail.subject,
      text,
      html,
    }),
  }).catch(() => null);
  return res?.ok ? null : 'send_failed';
}

/** En son gönderilen kodu doğrular; başarılıysa kodu kullanılmış olarak işaretler. */
export async function checkVerificationCode(email: string, code: unknown): Promise<VerifyError | null> {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return 'invalid_code';
  const db = createAdminClient();
  const { data: row } = await db
    .from('email_verifications')
    .select('id, code_hash, attempts, expires_at, verified_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || row.verified_at) return 'invalid_code';
  if (new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) return 'code_expired';

  const expected = Buffer.from(row.code_hash, 'hex');
  const given = Buffer.from(hashCode(email, code.trim()), 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.from('email_verifications').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    return 'invalid_code';
  }
  await db.from('email_verifications').update({ verified_at: new Date().toISOString() }).eq('id', row.id);
  return null;
}
