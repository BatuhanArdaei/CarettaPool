// Caretta Pool product catalog — all dimensions in meters.

export interface PoolProduct {
  slug: string;
  name: string;
  width: number;
  length: number;
  rgbLights: number;
  inletNozzles: number;
  cleanerNozzles: number;
  vacuumNozzles: number;
  skimmerCount: number;
  /** Image path under /public — drop your render here (transparent PNG). */
  image: string;
}

export const POOL_PRODUCTS: PoolProduct[] = [
  {
    slug: 'antalya',
    name: 'ANTALYA',
    width: 2.30,
    length: 4.00,
    rgbLights: 2,
    inletNozzles: 3,
    cleanerNozzles: 1,
    vacuumNozzles: 2,
    skimmerCount: 2,
    image: '/havuz_antalya.png',
  },
  {
    slug: 'malta',
    name: 'MALTA',
    width: 2.30,
    length: 6.00,
    rgbLights: 3,
    inletNozzles: 4,
    cleanerNozzles: 1,
    vacuumNozzles: 2,
    skimmerCount: 2,
    image: '/havuz_malta.png',
  },
  {
    slug: 'creta',
    name: 'CRETA',
    width: 2.30,
    length: 8.00,
    rgbLights: 3,
    inletNozzles: 6,
    cleanerNozzles: 1,
    vacuumNozzles: 2,
    skimmerCount: 2,
    image: '/havuz_creta.png',
  },
  {
    slug: 'bali',
    name: 'BALI',
    width: 2.30,
    length: 10.00,
    rgbLights: 4,
    inletNozzles: 8,
    cleanerNozzles: 1,
    vacuumNozzles: 2,
    skimmerCount: 2,
    image: '/havuz_bali.png',
  },
  {
    slug: 'cuba',
    name: 'CUBA',
    width: 2.30,
    length: 12.00,
    rgbLights: 5,
    inletNozzles: 8,
    cleanerNozzles: 1,
    vacuumNozzles: 2,
    skimmerCount: 2,
    image: '/havuz_cuba.png',
  },
  {
    slug: 'rio',
    name: 'RIO',
    width: 2.30,
    length: 13.00,
    rgbLights: 5,
    inletNozzles: 8,
    cleanerNozzles: 1,
    vacuumNozzles: 2,
    skimmerCount: 2,
    image: '/havuz_rio.png',
  },
];

export function getProductSpecs(p: PoolProduct): string[] {
  return [
    'Makine Odası',
    'Otomatik Panjur Sistemi',
    'İç ve Dış Yüzeyler için Özel Poliürea Kaplama',
    'İç ve Dış Yüzeyler için Özel Poliaspartik Boya Kaplama',
    'Makine Odası Zemininde UV Kompakt Laminat Kaplama',
    'Akrilik Cam Paneller Olmayan Alanlar Dahil, Dış Cephe UV Kompozit Panel Kaplama',
    `Uzaktan Kontrol Edilebilir ${p.rgbLights} Adet RGB LED Aydınlatma`,
    `Montaj ve Üfleme Dahil ${p.inletNozzles} Adet Besleme Nozulu`,
    `Montaj ve Borulama Dahil ${p.cleanerNozzles} Adet Havuz Temizleme Nozulu`,
    `Montaj ve Emiş Dahil ${p.vacuumNozzles} Adet Vakum Emme Nozulu`,
    `Montaj ve Borulama Dahil ${p.skimmerCount} Adet Skimmer (Yüzey Temizleyici)`,
  ];
}

export type SpecItem = { key: string; n?: number };

export function getProductSpecItems(p: PoolProduct): SpecItem[] {
  return [
    { key: 'products.spec_machine_room' },
    { key: 'products.spec_shutter' },
    { key: 'products.spec_polyurea' },
    { key: 'products.spec_polyaspartic' },
    { key: 'products.spec_laminat' },
    { key: 'products.spec_composite' },
    { key: 'products.spec_rgb',      n: p.rgbLights },
    { key: 'products.spec_inlet',    n: p.inletNozzles },
    { key: 'products.spec_cleaner',  n: p.cleanerNozzles },
    { key: 'products.spec_vacuum',   n: p.vacuumNozzles },
    { key: 'products.spec_skimmer',  n: p.skimmerCount },
  ];
}

export function formatDimensions(p: PoolProduct): string {
  return `${p.width.toFixed(2).replace('.', ',')} × ${p.length.toFixed(2).replace('.', ',')}`;
}
