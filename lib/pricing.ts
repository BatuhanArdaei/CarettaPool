import { countPanels, type PoolConfig } from './types';

const BASE_PER_SQM = 22000;

const FRAME_PRICES = {
  anthracite: 0,
  blue: 5000,
  white: 5000,
} as const;

const GLASS_PER_PANEL = 4500;       // her cam bölme için
const CLOSED_PER_PANEL = 0;         // kapalı bölmeler tabana dahil

const GROUND_PRICES = {
  gravel: 0,
  wood: 22000,
  grass: 8000,
  concrete: 12000,
} as const;

const CLADDING_PRICES = {
  white: 0,
  blue_mosaic: 18000,
  gray_stone: 26000,
  turquoise: 14000,
  texture1: 32000,
  texture2: 32000,
  texture3: 32000,
  texture4: 32000,
  texture5: 32000,
} as const;

const LIGHTING_PRICE = 9000;
const WATERFALL_PRICE = 25000;
const PLATFORM_BASE_PRICE = 35000; // her zaman dahil

export interface PriceBreakdown {
  base: number;
  frame: number;
  panel: number;
  ground: number;
  cladding: number;
  platform: number;
  lighting: number;
  waterfall: number;
  subtotal: number;
  discount: number;
  total: number;
}

export function calculateBasePrice(config: PoolConfig): PriceBreakdown {
  const area = config.width * config.length;
  const base = Math.round(area * BASE_PER_SQM);
  const frame = FRAME_PRICES[config.frameColor];
  const counts = countPanels(config);
  const panel =
    counts.glass * GLASS_PER_PANEL + counts.closed * CLOSED_PER_PANEL;
  const ground = GROUND_PRICES[config.ground];
  const cladding = CLADDING_PRICES[config.cladding];
  const platform = PLATFORM_BASE_PRICE;
  const lighting = config.lighting.enabled ? LIGHTING_PRICE : 0;
  const waterfall = config.waterfall ? WATERFALL_PRICE : 0;

  const subtotal =
    base + frame + panel + ground + cladding + platform + lighting + waterfall;

  return {
    base,
    frame,
    panel,
    ground,
    cladding,
    platform,
    lighting,
    waterfall,
    subtotal,
    discount: 0,
    total: subtotal,
  };
}

export function applyDealerDiscount(
  breakdown: PriceBreakdown,
  discountRate: number
): PriceBreakdown {
  const discount = Math.round(breakdown.subtotal * (discountRate / 100));
  return {
    ...breakdown,
    discount,
    total: breakdown.subtotal - discount,
  };
}

export function formatTRY(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}
