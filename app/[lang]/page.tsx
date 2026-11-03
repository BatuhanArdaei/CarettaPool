import HeroSlider from '@/components/HeroSlider';
import HomeContent from '@/app/HomeContent';
import { getMessages, createT } from '@/lib/i18n/server';
import { pageAlternates } from '@/lib/site';
import type { LangCode } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: { lang: string } }) {
  const msgs = await getMessages(params.lang as LangCode);
  const t = createT(msgs);
  return {
    title: `Caretta Pool — ${t('hero.title')}`,
    description: t('hero.description'),
    alternates: pageAlternates(params.lang, 'home'),
  };
}

export default function HomePage() {
  return (
    <div>
      <HeroSlider />
      <HomeContent />
    </div>
  );
}
