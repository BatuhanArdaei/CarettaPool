import type { CladdingType } from './types';

/**
 * Havuz iç yüzeyi renk paleti. Eski kayıtlarla uyum için ilk dört renk önceki hazır değerleri
 * ('white', 'gray_stone', 'turquoise', 'blue_mosaic') korur; yeni renkler hex olarak saklanır.
 */
export const POOL_COLORS: { value: CladdingType; hex: string; labelKey: string }[] = [
  { value: 'white',       hex: '#f1f5f9', labelKey: 'configurator.white_cladding' },
  { value: '#d6dadf',     hex: '#d6dadf', labelKey: 'configurator.color_light_gray' },
  { value: 'gray_stone',  hex: '#6b7280', labelKey: 'configurator.color_gray' },
  { value: '#2f353b',     hex: '#2f353b', labelKey: 'configurator.color_anthracite' },
  { value: '#d9c7a5',     hex: '#d9c7a5', labelKey: 'configurator.color_sand' },
  { value: 'turquoise',   hex: '#14b8a6', labelKey: 'configurator.turquoise_cladding' },
  { value: '#5bb7e0',     hex: '#5bb7e0', labelKey: 'configurator.color_light_blue' },
  { value: 'blue_mosaic', hex: '#2563eb', labelKey: 'configurator.color_blue' },
  { value: '#1e3a5f',     hex: '#1e3a5f', labelKey: 'configurator.color_navy' },
];

/** Kaplama bir seramik doku mu (döşeme), yoksa düz renk mi? */
export function isTileCladding(c: CladdingType): boolean {
  return c.startsWith('/textures/') || /^texture\d$/.test(c);
}

/** Renk kaplamasının hex değeri (palette yoksa ve hex ise kendisi). */
export function claddingHex(c: CladdingType): string | null {
  const p = POOL_COLORS.find((x) => x.value === c);
  if (p) return p.hex;
  return c.startsWith('#') ? c : null;
}
