import { createClient } from '@/lib/supabase/server';
import ContactForm from './ContactForm';

export const metadata = { title: 'İletişim — CarettaPool' };
export const revalidate = 60;

interface ContactSettings {
  phones?: string[];
  email?: string;
  address?: string;
}

export default async function IletisimPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['contact', 'social']);

  const contact: ContactSettings =
    (data?.find((r) => r.key === 'contact')?.value as ContactSettings) ?? {};

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Bize Ulaşın
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          İletişim
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-500">
          Tasarımınız hakkında bilgi almak veya teklif istemek için bize
          ulaşın.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {/* Contact info */}
          <div className="space-y-6">
            {contact.phones?.length ? (
              <InfoBlock label="Bizi Arayın">
                {contact.phones.filter(Boolean).map((p) => (
                  <a key={p} href={`tel:${p.replace(/\s/g, '')}`}
                    className="block text-base font-medium text-slate-900 hover:text-brand-600">
                    {p}
                  </a>
                ))}
              </InfoBlock>
            ) : null}

            {contact.email && (
              <InfoBlock label="E-Posta">
                <a href={`mailto:${contact.email}`}
                  className="text-base font-medium text-slate-900 hover:text-brand-600">
                  {contact.email}
                </a>
              </InfoBlock>
            )}

            {contact.address && (
              <InfoBlock label="Merkez Ofis">
                <p className="text-base font-medium text-slate-900 whitespace-pre-line">
                  {contact.address}
                </p>
              </InfoBlock>
            )}
          </div>

          {/* Form */}
          <ContactForm />
        </div>
      </section>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}
