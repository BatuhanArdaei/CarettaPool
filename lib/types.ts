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
export type InstallationType = 'ground' | 'partial' | 'sunken';
export type StairStyle = 'none' | 'open' | 'block';
/** Havuza giriş: iç merdiven ya da havuz içi basamak tipleri */
export type PoolEntry = 'small_stairs' | 'wide_stairs' | 'bench' | 'none';
export type PoolSide = 'north' | 'south' | 'east' | 'west';

export const POOL_SIDES: PoolSide[] = ['north', 'south', 'east', 'west'];

/**
 * Dış aydınlatma: dış şerit LED. (Güneş enerjili lamba ve kapalı panel aplikleri kaldırıldı;
 * eski kayıtlarda kalan `solar` / `panels` alanları yok sayılır.)
 */
export interface OutdoorLighting {
  strip: boolean;
}

export function outdoorLightingOf(config: Pick<PoolConfig, 'outdoorLighting'>): OutdoorLighting {
  return { strip: config.outdoorLighting?.strip === true };
}

/** Herhangi bir ışık açıkken sahne gece moduna geçer. */
export function isNightScene(config: Pick<PoolConfig, 'lighting' | 'outdoorLighting'>): boolean {
  return config.lighting.enabled || outdoorLightingOf(config).strip;
}

export interface PoolConfig {
  width: number;
  length: number;
  frameColor: FrameColor;
  panel: PanelType;                       // global default applied to new segments
  panelOverrides: Record<string, PanelType>; // key: `${side}-${index}`
  /** İç aydınlatma: havuz içi RGB LED (mobil uygulamadan kontrol) */
  lighting: {
    enabled: boolean;
    color: LightColor;
  };
  /** Dış aydınlatma seçenekleri (eski kayıtlarda yok) */
  outdoorLighting?: OutdoorLighting;
  ground: GroundType;
  installation: InstallationType; // yerüstü / yarı gömülü / tam gömülü
  cladding: CladdingType;
  platformDirection: PlatformDirection;
  platformExtension: boolean;
  /** Makine dairesi dışındaki kenarlara eklenen dekorlu teras uzatmaları */
  extensionSides?: PoolSide[];
  railings: boolean;
  stairStyle: StairStyle; // platform (dış) merdiveni: yok / açık basamak / blok basamak
  poolEntry: PoolEntry;
  /** @deprecated eski kayıtlar için; yerine poolEntry */
  innerLadder?: boolean;
  waterfall: boolean;
  poolCover: boolean;   // optional slatted roller cover over the water
  poolCoverType: PoolCoverType; // automatic or manual operation (roller either way)
  poolCoverClosed: boolean;
  liftDeck: boolean;      // köşe kolonlarında yukarı/aşağı hareket eden güverte (havuz üstünü kapatır)
  liftDeckUp: boolean;    // önizleme: güverte yukarıda (true) ya da havuzu kapatmış (false)
  liftDeckSolar: boolean; // güverte üstünde güneş paneli (yalnızca liftDeck ile)
  /** 3D'de görünmeyen teknik ekipmanlar (ısı pompası, swimjet, dozaj, tuz elektrolizi, UV) */
  equipment: Partial<Record<'heatPump' | 'swimJet' | 'dosing' | 'saltChlorinator' | 'blueLagoon', boolean>>; // preview-only: show the cover closed (true) or open/retracted (false)
  showWater: boolean;
}

export const defaultPoolConfig: PoolConfig = {
  width: 2.30,
  length: 4,
  frameColor: 'anthracite',
  panel: 'closed',
  panelOverrides: {},
  lighting: { enabled: false, color: 'white' },
  outdoorLighting: { strip: false },
  ground: 'grass',
  installation: 'ground',
  cladding: 'white',
  platformDirection: 'east',
  platformExtension: false,
  extensionSides: [],
  railings: false,
  stairStyle: 'none',
  poolEntry: 'none',
  waterfall: false,
  poolCover: false,
  poolCoverType: 'automatic',
  poolCoverClosed: true,
  liftDeck: false,
  liftDeckUp: true,
  liftDeckSolar: false,
  equipment: {},
  showWater: false,
};

/** Tam gömülü kurulum: korkuluk, dış merdiven ve cam panel kullanılmaz. */
export function isSunken(config: Pick<PoolConfig, 'installation'>): boolean {
  return config.installation === 'sunken';
}

/** Teras uzatması eklenmiş kenarlar (makine dairesi kenarı hariç, tekrarsız ve geçerli). */
export function extensionSidesOf(config: Pick<PoolConfig, 'extensionSides' | 'platformDirection'>): PoolSide[] {
  const list = Array.isArray(config.extensionSides) ? config.extensionSides : [];
  return POOL_SIDES.filter((s) => s !== config.platformDirection && list.includes(s));
}

export function panelKey(side: PoolSide, index: number): string {
  return `${side}-${index}`;
}

export function getPanelType(
  config: PoolConfig,
  side: PoolSide,
  index: number
): PanelType {
  if (side === 'east') return 'closed'; // makine dairesi — her zaman kapalı
  if (isSunken(config)) return 'closed'; // tam gömülü: paneller toprak altında, cam kullanılmaz
  return config.panelOverrides[panelKey(side, index)] ?? config.panel;
}

/** Fixed real-world panel width used to auto-calculate segment counts. */
export const PANEL_W = 2.40;

/** Kesik camın en küçük boyu: bundan kısa artık, son cama eklenir (ayrı parça kesilmez). */
export const PANEL_MIN_CUT = 0.05;

/**
 * Kenar boyunca cam/panel ölçüleri (metre): standart 2,40 m camlar dizilir, kalan ara ölçü
 * için tek bir kesik cam eklenir. Örn. 5 m → [2.40, 2.40, 0.20], 6 m → [2.40, 2.40, 1.20],
 * 2,3 m → [2.30].
 */
export function panelSegments(span: number): number[] {
  const full = Math.floor((span + 1e-6) / PANEL_W);
  const rest = Math.round((span - full * PANEL_W) * 1000) / 1000;
  if (full === 0) return [span];
  const segs: number[] = Array(full).fill(PANEL_W);
  if (rest >= PANEL_MIN_CUT) segs.push(rest);
  else if (rest > 0) segs[segs.length - 1] += rest;
  return segs;
}

/** Kenarın nominal boyu: kuzey/güney → genişlik, doğu/batı → uzunluk. */
export function sideSpan(side: PoolSide, config: Pick<PoolConfig, 'width' | 'length'>): number {
  return side === 'north' || side === 'south' ? config.width : config.length;
}

/** Bir kenardaki cam/panel ölçüleri. */
export function sidePanelSegments(side: PoolSide, config: Pick<PoolConfig, 'width' | 'length'>): number[] {
  return panelSegments(sideSpan(side, config));
}

/** Bir kenardaki panel sayısı (standart 2,40 m camlar + varsa kesik cam). */
export function segmentsForSide(side: PoolSide, config: PoolConfig): number {
  return sidePanelSegments(side, config).length;
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

/**
 * Havuza giriş tipi. Metal merdiven kaldırıldı: eski kayıtlardaki merdiven (poolEntry 'ladder'
 * ya da innerLadder) küçük basamak olarak açılır.
 */
export function poolEntryOf(config: Pick<PoolConfig, 'poolEntry' | 'innerLadder'>): PoolEntry {
  const e = config.poolEntry as string | undefined;
  if (e && e !== 'ladder') return e as PoolEntry;
  if (!e && config.innerLadder === false) return 'none';
  return 'small_stairs';
}
