import { countPanels, extensionSidesOf, isSunken, outdoorLightingOf, poolEntryOf, type PoolConfig } from './types';

// ─── Global defaults (used when no site/dealer override is set) ──────────────
export const DEFAULT_PRICES = {
  base_per_sqm:          22000,
  frame_blue:            5000,
  frame_white:           5000,
  frame_anthracite:      0,
  panel_glass:           4500,
  panel_closed:          0,
  ground_gravel:         0,
  ground_wood:           22000,
  ground_grass:          8000,
  ground_concrete:       12000,
  cladding_white:        0,
  cladding_blue_mosaic:  18000,
  cladding_gray_stone:   26000,
  cladding_turquoise:    14000,
  cladding_texture:      32000,
  cladding_color:        0,
  lighting:              9000,
  light_strip_outdoor:   0,
  waterfall:             25000,
  platform:              35000,
  platform_extension:    0,
  side_extension:        0,
  installation_partial:  0,
  installation_sunken:   0,
  railings:              0,
  stairs_block:          0,
  ladder:                0,
  entry_small_stairs:    0,
  entry_wide_stairs:     0,
  entry_bench:           0,
  pool_cover_manual:     38000,
  pool_cover_automatic:  55000,
  lift_deck:             0,
  lift_deck_solar:       0,
  eq_heat_pump:          0,
  eq_swimjet:            0,
  eq_dosing:             0,
  eq_salt:               0,
  eq_blue_lagoon:        0,
} as const;

export type PriceKey = keyof typeof DEFAULT_PRICES;

// Key-by-key override map. Any key not present falls back to DEFAULT_PRICES.
export type CustomPrices = Partial<Record<string, number>>;

const ENTRY_PRICE: Record<string, (c: CustomPrices | null) => number> = {
  small_stairs: (c) => pr(c, 'entry_small_stairs'),
  wide_stairs:  (c) => pr(c, 'entry_wide_stairs'),
  bench:        (c) => pr(c, 'entry_bench'),
  none:         () => 0,
};

function pr(custom: CustomPrices | null, key: PriceKey): number {
  return (custom != null && key in custom) ? (custom[key] as number) : DEFAULT_PRICES[key];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PriceBreakdown {
  base: number;
  frame: number;
  panel: number;
  ground: number;
  installation: number;
  cladding: number;
  platform: number;
  lighting: number;
  waterfall: number;
  accessories: number;
  poolCover: number;
  liftDeck: number;
  equipment: number;
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

  const installation =
    config.installation === 'partial' ? pr(customPrices, 'installation_partial')
    : config.installation === 'sunken' ? pr(customPrices, 'installation_sunken')
    : 0;

  const STD_CLADDINGS = new Set(['white', 'blue_mosaic', 'gray_stone', 'turquoise']);
  const cladding = config.cladding.startsWith('#')
    ? pr(customPrices, 'cladding_color')
    : STD_CLADDINGS.has(config.cladding)
    ? pr(customPrices, `cladding_${config.cladding}` as PriceKey)
    : pr(customPrices, 'cladding_texture');

  const platform =
    pr(customPrices, 'platform') +
    (config.platformExtension ? pr(customPrices, 'platform_extension') : 0) +
    extensionSidesOf(config).length * pr(customPrices, 'side_extension');

  const outdoor = outdoorLightingOf(config);
  const lighting =
    (config.lighting.enabled ? pr(customPrices, 'lighting') : 0) +
    (outdoor.strip ? pr(customPrices, 'light_strip_outdoor') : 0);

  // Hareketli güverte şelale ve havuz kapağıyla birlikte olamaz
  const waterfall = config.waterfall && !config.liftDeck ? pr(customPrices, 'waterfall') : 0;

  const accessories =
    (config.railings && !isSunken(config) ? pr(customPrices, 'railings') : 0) +
    (config.stairStyle === 'block' && !isSunken(config) ? pr(customPrices, 'stairs_block') : 0) +
    ENTRY_PRICE[poolEntryOf(config)](customPrices);

  const poolCover = config.poolCover && !config.liftDeck
    ? pr(customPrices, config.poolCoverType === 'automatic' ? 'pool_cover_automatic' : 'pool_cover_manual')
    : 0;

  const liftDeck = config.liftDeck
    ? pr(customPrices, 'lift_deck') + (config.liftDeckSolar ? pr(customPrices, 'lift_deck_solar') : 0)
    : 0;

  const EQUIPMENT_KEYS: Record<string, PriceKey> = {
    heatPump: 'eq_heat_pump', swimJet: 'eq_swimjet', dosing: 'eq_dosing',
    saltChlorinator: 'eq_salt', blueLagoon: 'eq_blue_lagoon',
  };
  const equipment = Object.entries(config.equipment ?? {})
    .filter(([, on]) => on)
    .reduce((sum, [id]) => sum + (EQUIPMENT_KEYS[id] ? pr(customPrices, EQUIPMENT_KEYS[id]) : 0), 0);

  const subtotal = equipment + liftDeck + base + frame + panel + ground + installation + cladding + platform + lighting + waterfall + accessories + poolCover;

  return {
    base, frame, panel, ground, installation, cladding, platform,
    lighting, waterfall, accessories, poolCover, liftDeck, equipment, subtotal, discount: 0, total: subtotal,
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
