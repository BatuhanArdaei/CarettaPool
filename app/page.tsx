import HeroSlider from '@/components/HeroSlider';
import HomeContent from './HomeContent';

export const metadata = {
  title: 'CarettaPool — Yenilikçi Modüler Havuzlar',
  description: 'Lüks modüler Caretta havuzları. 3D konfigüratörümüzle havuzunuzu kendiniz tasarlayın.',
};

export default function HomePage() {
  return (
    <div>
      <HeroSlider />
      <HomeContent />
    </div>
  );
}
