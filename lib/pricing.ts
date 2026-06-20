import { countPanels, type PoolConfig } from './types';

// ─── Global defaults (used when no site/dealer override is set) ──────────────
export const DEFAULT_PRICES = {
  base_per_sqm:         22000,
  frame_blue:           5000,
  frame_white:          5000,
  frame_anthracite:     0,
  panel_glass:          4500,
  panel_closed:         0,
  ground_gravel:        0,
  ground_wood:          22000,
  ground_grass:         8000,
  ground_concrete:      12000,
  cladding_white:       0,
  cladding_blue_mosaic: 18000,
  cladding_gray_stone:  26000,
  cladding_turquoise:   14000,
  cladding_texture:     32000,
  lighting:             9000,
  waterfall:            25000,
  pool_cover:           38000,
  platform:             35000,
} as const;

export type PriceKey = keyof typeof DEFAULT_PRICES;

// Key-by-key override map. Any key not present falls back to DEFAULT_PRICES.
export type CustomPrices = Partial<Record<string, number>>;

function pr(custom: CustomPrices | null, key: PriceKey): number {
  return (custom != null && key in custom) ? (custom[key] as number) : DEFAULT_PRICES[key];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceBreakdown {
  base: number;
  frame: number;
  panel: number;
  ground: number;
  cladding: number;
  platform: number;
  lighting: number;
  waterfall: number;
  poolCover: number;
  subtotal: number;
  discount: number;
  total: number;
}

// ─── Calculation ─────────────────────────────────────────────────────────────
// customPrices overrides DEFAULT_PRICES key-by-key.
// Pass the merged (globalPrices + dealerPrices) map from the API layer.

export function calculateBasePrice(
  config: PoolConfig,
  customPrices: CustomPrices | null = null,
): PriceBreakdown {
  const area = config.width * config.length;
  const base = Math.round(area * pr(customPrices, 'base_per_sqm'));

  const frameKey = `frame_${config.frameColor}` as PriceKey;
  const frame = pr(customPrices, frameKey);

  const counts = countPanels(config);
  const panel =
    counts.glass  * pr(customPrices, 'panel_glass') +
    counts.closed * pr(customPrices, 'panel_closed');

  const groundKey = `ground_${config.ground}` as PriceKey;
  const ground = pr(customPrices, groundKey);

  const STD_CLADDINGS = new Set(['white', 'blue_mosaic', 'gray_stone', 'turquoise']);
  const cladding = STD_CLADDINGS.has(config.cladding)
    ? pr(customPrices, `cladding_${config.cladding}` as PriceKey)
    : pr(customPrices, 'cladding_texture');

  const platform  = pr(customPrices, 'platform');
  const lighting  = config.lighting.enabled ? pr(customPrices, 'lighting')  : 0;
  const waterfall = config.waterfall         ? pr(customPrices, 'waterfall') : 0;
  const poolCover = config.poolCover         ? pr(customPrices, 'pool_cover') : 0;

  const subtotal = base + frame + panel + ground + cladding + platform + lighting + waterfall + poolCover;

  return {
    base, frame, panel, ground, cladding, platform,
    lighting, waterfall, poolCover, subtotal, discount: 0, total: subtotal,
  };
}

export function applyDealerDiscount(
  breakdown: PriceBreakdown,
  discountRate: number,
): PriceBreakdown {
  const discount = Math.round(breakdown.subtotal * (discountRate / 100));
  return { ...breakdown, discount, total: breakdown.subtotal - discount };
}

export function formatTRY(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}
