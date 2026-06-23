export type FrameColor = 'anthracite' | 'blue' | 'white';
export type PanelType = 'glass' | 'closed';
export type LightColor =
  | 'blue' | 'white' | 'warm_white' | 'green' | 'cyan' | 'turquoise'
  | 'red' | 'orange' | 'pink' | 'purple' | 'rgb' | 'blue_purple';
export type GroundType = 'gravel' | 'wood' | 'grass' | 'concrete';
export type CladdingType =
  | 'white'
  | 'blue_mosaic'
  | 'gray_stone'
  | 'turquoise'
  | (string & {});  // texture file paths like '/textures/BEST CEPPO BONE 60x120.jpg'
export type PlatformDirection = 'north' | 'south' | 'east' | 'west';
export type PoolCoverType = 'automatic' | 'manual';
export type PoolSide = 'north' | 'south' | 'east' | 'west';

export const POOL_SIDES: PoolSide[] = ['north', 'south', 'east', 'west'];

export interface PoolConfig {
  width: number;
  length: number;
  frameColor: FrameColor;
  panel: PanelType;                       // global default applied to new segments
  panelOverrides: Record<string, PanelType>; // key: `${side}-${index}`
  lighting: {
    enabled: boolean;
    color: LightColor;
  };
  ground: GroundType;
  cladding: CladdingType;
  platformDirection: PlatformDirection;
  platformExtension: boolean;
  railings: boolean;
  innerLadder: boolean;
  waterfall: boolean;
  poolCover: boolean;   // optional slatted roller cover over the water
  poolCoverType: PoolCoverType; // automatic or manual operation (roller either way)
  poolCoverClosed: boolean; // preview-only: show the cover closed (true) or open/retracted (false)
  showWater: boolean;
}

export const defaultPoolConfig: PoolConfig = {
  width: 2.30,
  length: 4,
  frameColor: 'anthracite',
  panel: 'glass',
  panelOverrides: {},
  lighting: { enabled: false, color: 'blue' },
  ground: 'grass',
  cladding: 'white',
  platformDirection: 'east',
  platformExtension: false,
  railings: false,
  innerLadder: true,
  waterfall: false,
  poolCover: false,
  poolCoverType: 'automatic',
  poolCoverClosed: true,
  showWater: false,
};

export function panelKey(side: PoolSide, index: number): string {
  return `${side}-${index}`;
}

export function getPanelType(
  config: PoolConfig,
  side: PoolSide,
  index: number
): PanelType {
  if (side === 'east') return 'closed'; // makine dairesi — her zaman kapalı
  return config.panelOverrides[panelKey(side, index)] ?? config.panel;
}

/** Fixed real-world panel width used to auto-calculate segment counts. */
export const PANEL_W = 2.40;

/**
 * Returns the number of panels per side based on the pool's inner span.
 * The inner span for the short sides (north/south) is config.width minus
 * two frame thicknesses, and for the long sides (east/west) it is
 * config.length minus two frame thicknesses.
 */
export function segmentsForSide(side: PoolSide, config: PoolConfig): number {
  const span = side === 'north' || side === 'south' ? config.width : config.length;
  return Math.max(1, Math.round(span / PANEL_W));
}

export function countPanels(config: PoolConfig): { glass: number; closed: number } {
  let glass = 0;
  let closed = 0;
  for (const side of POOL_SIDES) {
    const segs = segmentsForSide(side, config);
    for (let i = 0; i < segs; i++) {
      if (getPanelType(config, side, i) === 'glass') glass++;
      else closed++;
    }
  }
  return { glass, closed };
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'customer' | 'dealer' | 'admin';
}

export interface Dealer {
  id: string;
  user_id: string;
  company_name: string;
  discount_rate: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  base_price: number;
  is_active: boolean;
}

export interface DealerPrice {
  id: string;
  dealer_id: string;
  product_id: string;
  custom_price: number;
}
