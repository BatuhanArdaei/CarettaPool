'use client';

import { useEffect } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLanguage } from '@/contexts/LanguageContext';

const TOUR_KEY = 'caretta_tour_done';

/* ── Step definitions ──────────────────────────────────── */
function buildSteps(lang: string): DriveStep[] {
  const s = {
    tr: [
      { title: '🏊 3D Önizleme',        desc: 'Havuzunuzun gerçek zamanlı 3D modelini buradan izleyin. Döndürmek için sürükleyin, yakınlaştırmak için kaydırın.' },
      { title: '🔄 Görünümü Sıfırla',   desc: 'Kamerayı başlangıç konumuna döndürür. Modeli her açıdan inceleyebilirsiniz.' },
      { title: '📋 Tasarım Adımları',   desc: '8 adımda havuzunuzu yapılandırın: Boyut → Çerçeve → Paneller → Şelale → Aydınlatma → Zemin → Kaplama → Özet.' },
      { title: '⚙️ Seçim Alanı',        desc: 'Her adımın seçenekleri burada görünür. Seçimleriniz 3D modele anında yansır.' },
      { title: '➡️ Adımlar Arası Geçiş', desc: 'İleri ve Geri butonlarıyla adımlar arasında geçiş yapın. Son adımda seçimlerinizi görebilir ve teklif talep edebilirsiniz.' },
    ],
    en: [
      { title: '🏊 3D Preview',      desc: 'See your pool in real-time 3D. Drag to rotate, scroll to zoom.' },
      { title: '🔄 Reset View',      desc: 'Returns the camera to its default position.' },
      { title: '📋 Design Steps',    desc: 'Configure your pool in 8 steps. Click any step to jump directly to it.' },
      { title: '⚙️ Options',         desc: 'Each step shows its options here. Your choices are instantly reflected in the 3D model.' },
      { title: '➡️ Navigation',      desc: 'Use Back and Next to move between steps. In the last step you can request a quote.' },
    ],
    de: [
      { title: '🏊 3D-Vorschau',            desc: 'Sehen Sie Ihren Pool in Echtzeit-3D. Ziehen zum Drehen, Scrollen zum Zoomen.' },
      { title: '🔄 Ansicht zurücksetzen',   desc: 'Setzt die Kamera auf die Standardposition zurück.' },
      { title: '📋 Entwurfsschritte',       desc: 'Konfigurieren Sie Ihren Pool in 8 Schritten. Klicken Sie auf einen Schritt, um direkt dorthin zu springen.' },
      { title: '⚙️ Optionen',               desc: 'Jeder Schritt zeigt seine Optionen hier. Ihre Auswahl spiegelt sich sofort im 3D-Modell wider.' },
      { title: '➡️ Navigation',             desc: 'Verwenden Sie Zurück und Weiter, um zwischen den Schritten zu wechseln. Im letzten Schritt können Sie ein Angebot anfordern.' },
    ],
  };

  const texts = (s as Record<string, typeof s.tr>)[lang] ?? s.en;
  const elements = ['#tour-preview', '#tour-reset', '#tour-stepper', '#tour-content', '#tour-nav'];
  const sides: DriveStep['popover']['side'][] = ['right', 'bottom', 'bottom', 'right', 'top'];

  return texts.map((t, i) => ({
    element: elements[i],
    popover: { title: t.title, description: t.desc, side: sides[i], align: 'center' },
  }));
}

/* ── Label sets ────────────────────────────────────────── */
const LABELS: Record<string, { next: string; prev: string; done: string; skip: string; progress: string }> = {
  tr: { next: 'Sonraki →', prev: '← Geri', done: 'Tamamla ✓', skip: 'Eğitimi Atla', progress: '{current} / {total}' },
  en: { next: 'Next →',    prev: '← Back', done: 'Done ✓',    skip: 'Skip Tutorial', progress: '{current} / {total}' },
  de: { next: 'Weiter →',  prev: '← Zurück',done: 'Fertig ✓', skip: 'Tour überspringen', progress: '{current} / {total}' },
};

function getLabels(lang: string) {
  return LABELS[lang] ?? LABELS.en;
}

/* ── Main tour launcher ────────────────────────────────── */
export function startTour(lang: string) {
  const labels = getLabels(lang);
  let instance: ReturnType<typeof driver> | null = null;

  instance = driver({
    showProgress: true,
    showButtons: ['next', 'previous'],   // hide X icon; we add custom skip
    nextBtnText: labels.next,
    prevBtnText: labels.prev,
    doneBtnText: labels.done,
    progressText: labels.progress,
    smoothScroll: true,
    overlayOpacity: 0.5,
    popoverClass: 'caretta-tour-popover',
    onDestroyed: () => {
      localStorage.setItem(TOUR_KEY, '1');
    },
    onPopoverRender: (popover) => {
      // Inject "Eğitimi Atla" button before the nav buttons
      const skip = document.createElement('button');
      skip.innerText = labels.skip;
      skip.className = 'caretta-tour-skip';
      skip.addEventListener('click', () => {
        instance?.destroy();
      });
      popover.footerButtons.prepend(skip);
    },
    steps: buildSteps(lang),
  });

  instance.drive();
}

/* ── Auto-start on first visit ─────────────────────────── */
export function useTourAutoStart(lang: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    const BAYI_KEY = 'caretta_bayi_popup_dismissed';

    // If BayiPopup already dismissed this session → start after short delay
    if (sessionStorage.getItem(BAYI_KEY)) {
      const t = setTimeout(() => startTour(lang), 1000);
      return () => clearTimeout(t);
    }

    // Otherwise wait for popup to be dismissed first
    let timer: ReturnType<typeof setTimeout>;
    function onDismiss() {
      timer = setTimeout(() => startTour(lang), 400);
    }
    window.addEventListener('caretta:bayi-dismissed', onDismiss, { once: true });
    return () => {
      window.removeEventListener('caretta:bayi-dismissed', onDismiss);
      clearTimeout(timer);
    };
  }, [lang]);
}

/* ── "?" trigger button (placed in 3D panel) ───────────── */
export default function ConfigTour() {
  const { lang } = useLanguage();
  useTourAutoStart(lang);

  return (
    <button
      type="button"
      onClick={() => startTour(lang)}
      title={lang === 'tr' ? 'Turu başlat' : lang === 'de' ? 'Tour starten' : 'Start tour'}
      className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white hover:text-brand-600 transition"
    >
      ?
    </button>
  );
}
