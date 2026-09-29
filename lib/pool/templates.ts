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
  /** Cephe taban çizgisi (görüntüye oranla iki nokta). Havuz bu çizginin arkasına geçemez. */
  facade?: [Vec2, Vec2];
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
 * Görseller: ~10 m yükseklikten, villaya tam karşıdan drone çekimi (villa önünde ≥22×22 m boş alan;
 * 13 m havuz iki yönde de sığar). Kalibrasyon ölçümle: kaçış noktası zemin derzlerinden (derz yoksa
 * alan kenar bordürlerinden), kamera yüksekliği zemin kat cam yüksekliğinden (≈2,9 m), lens 24 mm.
 * `facade`: evin zemine oturduğu çizgi; havuz bunun arkasına geçmez. İnce ayar: Admin → Mekân Şablonları.
 */
export const POOL_TEMPLATES: PoolTemplate[] = [
  {
    id: 'mekan-1',
    nameKey: 'configurator.venue_1',
    ...asset('mekan-1'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.503, -0.038], focal35: 24, height: 10.5 },
    sun: { azimuth: -135, elevation: 40, intensity: 2.2, color: '#fff1dc' },
    placement: { centerA: -0.1, centerB: 22.5, rotation: 0 },
    facade: [[0.3, 0.405], [0.7, 0.405]],
  },
  {
    id: 'mekan-2',
    nameKey: 'configurator.venue_2',
    ...asset('mekan-2'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.507, -0.014], focal35: 24, height: 9.1 },
    sun: { azimuth: -130, elevation: 30, intensity: 2.2, color: '#ffe2b8' },
    placement: { centerA: -0.2, centerB: 20.5, rotation: 0 },
    facade: [[0.3, 0.415], [0.7, 0.415]],
  },
  {
    id: 'mekan-3',
    nameKey: 'configurator.venue_3',
    ...asset('mekan-3'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.505, 0.055], focal35: 24, height: 8.6 },
    sun: { azimuth: 30, elevation: 40, intensity: 1.3, color: '#fff4e6' },
    placement: { centerA: -0.15, centerB: 22, rotation: 0 },
    facade: [[0.3, 0.405], [0.7, 0.405]],
  },
  {
    id: 'mekan-4',
    nameKey: 'configurator.venue_4',
    ...asset('mekan-4'),
    aspect: 1672 / 941,
    focusX: 0.5,
    calibration: { mode: 'level', vp: [0.509, 0.005], focal35: 24, height: 8.7 },
    sun: { azimuth: 135, elevation: 45, intensity: 2.4, color: '#fff6e8' },
    placement: { centerA: -0.25, centerB: 20.5, rotation: 0 },
    facade: [[0.3, 0.4], [0.7, 0.4]],
  },
];

export function getTemplate(id: string | null | undefined): PoolTemplate {
  return POOL_TEMPLATES.find((t) => t.id === id) ?? POOL_TEMPLATES[0];
}
