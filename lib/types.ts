export type FrameColor = 'anthracite' | 'blue' | 'white';
export type PanelType = 'glass' | 'closed';
export type PanelSegments = 1 | 2 | 3 | 4;
export type LightColor = 'blue' | 'white' | 'green' | 'purple' | 'rgb';
export type GroundType = 'gravel' | 'wood' | 'grass' | 'concrete';
export type CladdingType =
  | 'white'
  | 'blue_mosaic'
  | 'gray_stone'
  | 'turquoise'
  | 'texture1'
  | 'texture2'
  | 'texture3'
  | 'texture4'
  | 'texture5';
export type PlatformDirection = 'north' | 'south' | 'east' | 'west';
export type PoolSide = 'north' | 'south' | 'east' | 'west';

export const POOL_SIDES: PoolSide[] = ['north', 'south', 'east', 'west'];

export interface PoolConfig {
  width: number;
  length: number;
  frameColor: FrameColor;
  panel: PanelType;                       // global default applied to new segments
  panelSegments: PanelSegments;
  panelOverrides: Record<string, PanelType>; // key: `${side}-${index}`
  lighting: {
    enabled: boolean;
    color: LightColor;
  };
  ground: GroundType;
  cladding: CladdingType;
  platformDirection: PlatformDirection;
  waterfall: boolean;
}

export const defaultPoolConfig: PoolConfig = {
  width: 4,
  length: 6,
  frameColor: 'anthracite',
  panel: 'glass',
  panelSegments: 2,
  panelOverrides: {},
  lighting: { enabled: false, color: 'blue' },
  ground: 'grass',
  cladding: 'white',
  platformDirection: 'east',
  waterfall: false,
};

export function panelKey(side: PoolSide, index: number): string {
  return `${side}-${index}`;
}

export function getPanelType(
  config: PoolConfig,
  side: PoolSide,
  index: number
): PanelType {
  return config.panelOverrides[panelKey(side, index)] ?? config.panel;
}

export function countPanels(config: PoolConfig): { glass: number; closed: number } {
  let glass = 0;
  let closed = 0;
  for (const side of POOL_SIDES) {
    for (let i = 0; i < config.panelSegments; i++) {
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
