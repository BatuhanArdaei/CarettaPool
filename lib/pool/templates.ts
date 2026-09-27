import type { Vec2 } from './calibration';

export interface TemplateSun {
  /** Kameraya göre güneş yönü (derece): 0 = kameranın arkası, 90 = sol, 180 = karşısı */
  azimuth: number;
  /** Ufuktan yükseklik (derece) */
  elevation: number;
  intensity: number;
  color: string;
}

export interface TemplatePlacement {
  /** Havuz + platform bütününün merkezi, kalibrasyon düzleminde (metre) */
  centerA: number;
  centerB: number;
  /** Havuzun uzun kenarının düzlemdeki açısı (derece) */
  rotation: number;
}

/**
 * - 'level': mimari fotoğraf tarzı yatay kamera (dik çizgiler paralel, lens kaydırmalı).
 *   a = yanal (sağ +), b = kameradan uzaklık.
 * - 'rect':  zemindeki bilinen ölçülü bir dikdörtgenin 4 köşesinden kalibrasyon.
 */
export type TemplateCalibration =
  | {
      mode: 'level';
      /** Zemin derinlik çizgilerinin kaçış noktası (görüntüye oranla 0–1) */
      vp: Vec2;
      /** 35 mm eşdeğer lens (mm) */
      focal35: number;
      /** Kamera yüksekliği (metre) */
      height: number;
    }
  | {
      mode: 'rect';
      /** Referans dikdörtgenin köşeleri (0–1): 1→2→3→4 */
      points: Vec2[];
      /** 1→2 ve 2→3 kenarlarının gerçek ölçüsü (metre) */
      width: number;
      depth: number;
      /** Biliniyorsa lens; yoksa dikdörtgenden tahmin edilir */
      focal35?: number;
    };

export interface PoolTemplate {
  id: string;
  /** Çeviri anahtarı (configurator.*) */
  nameKey: string;
  day: string;
  night: string;
  dayThumb: string;
  nightThumb: string;
  /** Görüntü en-boy oranı (genişlik / yükseklik) */
  aspect: number;
  /** Dar ekranlarda görselin yatayda hangi kısmının görüneceği (0 = sol, 1 = sağ) */
  focusX: number;
  calibration: TemplateCalibration;
  sun: TemplateSun;
  placement: TemplatePlacement;
}

export const DAY_ENVIRONMENT = '/hdr/kloofendal_48d_partly_cloudy_puresky_1k.hdr';
export const NIGHT_ENVIRONMENT = '/hdr/dikhololo_night_1k.hdr';

const asset = (id: string) => ({
  day: `/templates/${id}/day.jpg`,
  night: `/templates/${id}/night.jpg`,
  dayThumb: `/templates/${id}/day-thumb.jpg`,
  nightThumb: `/templates/${id}/night-thumb.jpg`,
});

/*
 * Başlangıç kalibrasyonları görsellerden ölçüldü: kaçış noktası zemin çizgilerinden,
 * kamera yüksekliği zemin–kapı üst kenarı oranından (yerden tavana kapı ≈ 2,8 m).
 * Yerleşim: havuz cepheden ~3,5 m önde, görüntünün yatay ortasında. `rotation`, cephe taban
 * çizgisinin zemindeki açısıdır (villalar kameraya göre ~10° dönük); havuz cepheye paralel durur. Lens promptta
 * istenen 24 mm. İnce ayar: Admin → Mekân Şablonları (zemin ızgarası ile).
 */
export const POOL_TEMPLATES: PoolTemplate[] = [
  {
    id: 'mekan-1',
    nameKey: 'configurator.venue_1',
    ...asset('mekan-1'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.677, 0.182], focal35: 24, height: 5.2 },
    sun: { azimuth: 60, elevation: 35, intensity: 2.2, color: '#fff1dc' },
    placement: { centerA: -3.05, centerB: 11.6, rotation: -10.5 },
  },
  {
    id: 'mekan-2',
    nameKey: 'configurator.venue_2',
    ...asset('mekan-2'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.677, 0.341], focal35: 24, height: 3.1 },
    sun: { azimuth: 70, elevation: 28, intensity: 2.2, color: '#ffe2b8' },
    placement: { centerA: -3.25, centerB: 12.3, rotation: -10 },
  },
  {
    id: 'mekan-3',
    nameKey: 'configurator.venue_3',
    ...asset('mekan-3'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.718, 0.242], focal35: 24, height: 4.65 },
    sun: { azimuth: 20, elevation: 40, intensity: 1.3, color: '#fff4e6' },
    placement: { centerA: -4.15, centerB: 12.7, rotation: -9.5 },
  },
  {
    id: 'mekan-4',
    nameKey: 'configurator.venue_4',
    ...asset('mekan-4'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.664, 0.249], focal35: 24, height: 4.3 },
    sun: { azimuth: 40, elevation: 55, intensity: 2.4, color: '#fff6e8' },
    placement: { centerA: -2.6, centerB: 10.5, rotation: -8.5 },
  },
];

export function getTemplate(id: string | null | undefined): PoolTemplate {
  return POOL_TEMPLATES.find((t) => t.id === id) ?? POOL_TEMPLATES[0];
}
