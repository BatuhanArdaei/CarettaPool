import HeroSlider from '@/components/HeroSlider';
import HomeContent from '@/app/HomeContent';
import { getMessages, createT } from '@/lib/i18n/server';
import type { LangCode } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: { lang: string } }) {
  const msgs = await getMessages(params.lang as LangCode);
  const t = createT(msgs);
  return {
    title: `CarettaPool — ${t('hero.title')}`,
    description: t('hero.description'),
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
