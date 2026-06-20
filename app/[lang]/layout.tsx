import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LANGUAGES, type LangCode } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/server';

const VALID_LANGS = new Set<string>(LANGUAGES.map((l) => l.code));

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { lang: string };
}) {
  if (!VALID_LANGS.has(params.lang)) notFound();

  const initialMessages = await getMessages(params.lang as LangCode);

  return (
    <LanguageProvider lang={params.lang as LangCode} initialMessages={initialMessages}>
      <Navbar />
      <main className="flex-1 pt-16 sm:pt-20 md:pt-24">{children}</main>
      <Footer lang={params.lang} />
      <WhatsAppButton />
    </LanguageProvider>
  );
}
