import { createClient } from '@/lib/supabase/server';
import ContactForm from './ContactForm';

export const metadata = { title: 'İletişim — CarettaPool' };
export const revalidate = 0;

interface ContactSettings {
  phones?: string[];
  email?: string;
  address?: string;
  maps_url?: string;
}

const DEFAULT_MAP_SRC =
  'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d11857.935885277422!2d6.813464!3d51.216352!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47b8cbc931e459c7%3A0xe3afc9fb4fe8ef15!2sFichtenstra%C3%9Fe%2036%2C%2040233%20D%C3%BCsseldorf-Stadtbezirk%202%2C%20Almanya!5e1!3m2!1str!2sus!4v1781314778191!5m2!1str!2sus';

function resolveMapSrc(contact: ContactSettings): string {
  if (contact.maps_url?.trim()) {
    const raw = contact.maps_url.trim();
    const match = raw.match(/src=["']([^"']+)["']/);
    return match ? match[1] : raw;
  }
  return DEFAULT_MAP_SRC;
}

export default async function IletisimPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['contact', 'social']);

  const contact: ContactSettings =
    (data?.find((r) => r.key === 'contact')?.value as ContactSettings) ?? {};

  const mapSrc = resolveMapSrc(contact);

  return (
    <div className="bg-white">
      {/* Content */}
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

      {/* Google Maps — full-width strip at the bottom */}
      <div className="h-[320px] w-full md:h-[420px]">
        <iframe
          src={mapSrc}
          width="100%"
          height="100%"
          style={{ border: 0, display: 'block' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Ofis Konumu"
        />
      </div>
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
