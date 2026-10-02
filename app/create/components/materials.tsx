'use client';

/**
 * Havuz parçaları için gerçekçi malzemeler.
 *
 * - Beam: kenarları hafif yuvarlatılmış kutu. Gerçek profiller ışığı kenarda yakalar;
 *   keskin kutular "çizim" hissi verir. UV'ler metre cinsindendir (ExtrudeGeometry),
 *   bu yüzden dokular her boyutta aynı ölçekte durur.
 * - WoodMaterial: Poly Haven "Wood Floor Deck" PBR seti (CC0) — renk + normal + pürüz/AO.
 *   Tahtalar dokuda U yönünde uzanır; ahşap parçaların uzun kenarı X ekseninde olmalı.
 * - PowderCoatMaterial: RAL rengi + kodla üretilen "portakal kabuğu" boya dokusu.
 * - GlassMaterial: bakış açısına göre yansıyan cam (Fresnel). Transmission kullanılmaz;
 *   yarı saydam su kütlesi camın arkasında görünmeye devam eder.
 * - Tile maps: karo derzi için normal + pürüz haritası (kaplama dokularının üstüne).
 */

import { useCallback, useMemo, type ComponentProps } from 'react';
import { useLoader } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/* ── Yuvarlatılmış kenarlı kutu ─────────────────────────────────────────── */

type BeamProps = Omit<ComponentProps<typeof RoundedBox>, 'args'> & {
  args: [number, number, number];
};

export function Beam({ args, radius = 0.006, children, ...rest }: BeamProps) {
  const r = Math.max(0.001, Math.min(radius, Math.min(...args) / 2 - 0.0005));
  return (
    <RoundedBox args={args} radius={r} smoothness={2} bevelSegments={1} {...rest}>
      {children}
    </RoundedBox>
  );
}

/* ── Ahşap ──────────────────────────────────────────────────────────────── */

const WOOD = {
  map: '/textures/pbr/wood_deck/diff.webp',
  normalMap: '/textures/pbr/wood_deck/nor_gl.webp',
  arm: '/textures/pbr/wood_deck/arm.webp', // R = AO, G = pürüz, B = metal
  meters: 1.8, // dokunun gerçek boyutu
};

function tileWorld(t: THREE.Texture, meters: number, srgb: boolean) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / meters, 1 / meters);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
}

export function WoodMaterial({ envMapIntensity = 0.7 }: { envMapIntensity?: number }) {
  const [map, normalMap, arm] = useLoader(THREE.TextureLoader, [WOOD.map, WOOD.normalMap, WOOD.arm]);
  useMemo(() => {
    tileWorld(map, WOOD.meters, true);
    tileWorld(normalMap, WOOD.meters, false);
    tileWorld(arm, WOOD.meters, false);
  }, [map, normalMap, arm]);

  return (
    <meshStandardMaterial
      map={map}
      normalMap={normalMap}
      roughnessMap={arm}
      aoMap={arm}
      aoMapIntensity={0.8}
      roughness={1}
      metalness={0}
      envMapIntensity={envMapIntensity}
    />
  );
}

/* ── Prosedürel dokular (indirme gerektirmez) ───────────────────────────── */

/** 0–1 arası, kenarları sarmalanan (tileable) değer gürültüsü. */
function tileableNoise(size: number, cells: number, seed: number): Float32Array {
  const grid = new Float32Array(cells * cells);
  let s = seed;
  for (let i = 0; i < grid.length; i++) {
    s = (s * 16807) % 2147483647;
    grid[i] = s / 2147483647;
  }
  const out = new Float32Array(size * size);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells;
      const gy = (y / size) * cells;
      const x0 = Math.floor(gx) % cells;
      const y0 = Math.floor(gy) % cells;
      const x1 = (x0 + 1) % cells;
      const y1 = (y0 + 1) % cells;
      const fx = smooth(gx - Math.floor(gx));
      const fy = smooth(gy - Math.floor(gy));
      const a = grid[y0 * cells + x0] + (grid[y0 * cells + x1] - grid[y0 * cells + x0]) * fx;
      const b = grid[y1 * cells + x0] + (grid[y1 * cells + x1] - grid[y1 * cells + x0]) * fx;
      out[y * size + x] = a + (b - a) * fy;
    }
  }
  return out;
}

/** Yükseklik alanından tileable normal harita üretir. */
function heightToNormalCanvas(h: Float32Array, size: number, strength: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function grayCanvas(values: Float32Array, size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < values.length; i++) {
    const v = Math.max(0, Math.min(255, values[i] * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function canvasTexture(canvas: HTMLCanvasElement, repeat: THREE.Vector2Tuple) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ── Toz boya metal ─────────────────────────────────────────────────────── */

const POWDER_METERS = 0.35; // bir doku tekrarının gerçek boyutu
let powderMaps: { normal: THREE.Texture; rough: THREE.Texture } | null = null;

function getPowderMaps() {
  if (powderMaps) return powderMaps;
  const size = 256;
  const fine = tileableNoise(size, 64, 7);
  const mid = tileableNoise(size, 16, 13);
  const height = fine.map((v, i) => v * 0.9 + mid[i] * 0.1);
  const rough = mid.map((v, i) => 0.9 + v * 0.06 + fine[i] * 0.04);
  const repeat: THREE.Vector2Tuple = [1 / POWDER_METERS, 1 / POWDER_METERS];
  powderMaps = {
    normal: canvasTexture(heightToNormalCanvas(height, size, 1.5), repeat),
    rough: canvasTexture(grayCanvas(rough, size), repeat),
  };
  return powderMaps;
}

export function PowderCoatMaterial({
  color,
  roughness = 0.62,
  metalness = 0.25,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  const maps = useMemo(getPowderMaps, []);
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      normalMap={maps.normal}
      normalScale={POWDER_NORMAL_SCALE}
      roughnessMap={maps.rough}
      envMapIntensity={0.9}
    />
  );
}
const POWDER_NORMAL_SCALE = new THREE.Vector2(0.1, 0.1);

/* ── Cam ────────────────────────────────────────────────────────────────── */

const GLASS_FRAGMENT = /* glsl */ `
  // Fresnel: dik bakışta saydam, yatık açıda yansıtıcı (gerçek camdaki gibi)
  float glassFresnel = pow(1.0 - saturate(abs(dot(normal, geometryViewDir))), 3.0);
  diffuseColor.a = mix(diffuseColor.a, 0.92, glassFresnel);
  #include <opaque_fragment>
`;

export function GlassMaterial() {
  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', GLASS_FRAGMENT);
  }, []);
  const cacheKey = useCallback(() => 'caretta-fresnel-glass', []);

  return (
    <meshPhysicalMaterial
      color="#d9ece6"
      transparent
      opacity={0.1}
      roughness={0.02}
      metalness={0}
      ior={1.5}
      specularIntensity={1}
      clearcoat={1}
      clearcoatRoughness={0.02}
      envMapIntensity={2}
      depthWrite={false}
      side={THREE.DoubleSide}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={cacheKey}
    />
  );
}

/* ── Zemin: doku tekrarını kırma ────────────────────────────────────────── */

const GROUND_NOISE = /* glsl */ `
  float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float groundNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), u.x),
               mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

const GROUND_MAP_FRAGMENT = /* glsl */ `
  #ifdef USE_MAP
    // Aynı doku iki ölçekte örneklenip düşük frekanslı gürültüyle karıştırılır;
    // üstüne geniş alanlı renk dalgalanması eklenir → tekrar eden kareler kaybolur.
    vec2 gUv = vMapUv;
    vec4 gA = texture2D(map, gUv);
    vec4 gB = texture2D(map, gUv * 0.63 + vec2(0.37, 0.71));
    vec4 sampledDiffuseColor = mix(gA, gB, smoothstep(0.3, 0.7, groundNoise(gUv * 0.23)));
    sampledDiffuseColor.rgb *= 0.84 + 0.28 * groundNoise(gUv * 0.09 + 7.3);
    diffuseColor *= sampledDiffuseColor;
  #endif
`;

/** meshStandardMaterial'e onBeforeCompile olarak verilir (zemin dokuları için). */
export function groundAntiTile(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${GROUND_NOISE}`)
    .replace('#include <map_fragment>', GROUND_MAP_FRAGMENT);
}

export const groundAntiTileKey = () => 'caretta-ground-antitile';

/* ── Karo derzi ─────────────────────────────────────────────────────────── */

let tileMaps: { normal: THREE.Texture; rough: THREE.Texture } | null = null;

/** Tek karo için derz haritaları (kaplama dokusuyla aynı repeat ile kullanılır). */
export function getTileMaps() {
  if (tileMaps) return tileMaps;
  const size = 256;
  const grout = 3; // px, derz yarı genişliği
  const bevel = 5; // px, karo kenar yuvarlaması
  const surface = tileableNoise(size, 32, 29);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      const i = y * size + x;
      if (edge < grout) {
        height[i] = 0;
        rough[i] = 1;
      } else {
        const t = Math.min(1, (edge - grout) / bevel);
        height[i] = Math.sin((t * Math.PI) / 2) + surface[i] * 0.02;
        rough[i] = 0.32 + surface[i] * 0.1;
      }
    }
  }
  tileMaps = {
    normal: canvasTexture(heightToNormalCanvas(height, size, 1.4), [1, 1]),
    rough: canvasTexture(grayCanvas(rough, size), [1, 1]),
  };
  return tileMaps;
}

/* ── Güneş paneli ───────────────────────────────────────────────────────── */

let solarTexture: THREE.Texture | null = null;

/** Tek panel: 6 × 10 monokristal hücre, ince bara çizgileri, koyu arka levha (dikey yönlü). */
export function getSolarTexture() {
  if (solarTexture) return solarTexture;
  const cols = 6;
  const rows = 10;
  const W = 384;
  const H = 640;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d9dde2'; // hücre arası beyaz arka levha
  ctx.fillRect(0, 0, W, H);
  const gap = 4;
  const cw = (W - gap * (cols + 1)) / cols;
  const ch = (H - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gap + c * (cw + gap);
      const yy = gap + r * (ch + gap);
      const g = ctx.createLinearGradient(x, yy, x + cw, yy + ch);
      g.addColorStop(0, '#16233f');
      g.addColorStop(1, '#0b1428');
      ctx.fillStyle = g;
      // köşeleri pahlı monokristal hücre
      const k = 5;
      ctx.beginPath();
      ctx.moveTo(x + k, yy);
      ctx.lineTo(x + cw - k, yy);
      ctx.lineTo(x + cw, yy + k);
      ctx.lineTo(x + cw, yy + ch - k);
      ctx.lineTo(x + cw - k, yy + ch);
      ctx.lineTo(x + k, yy + ch);
      ctx.lineTo(x, yy + ch - k);
      ctx.lineTo(x, yy + k);
      ctx.closePath();
      ctx.fill();
      // bara çizgileri
      ctx.strokeStyle = 'rgba(190,198,210,0.55)';
      ctx.lineWidth = 1;
      for (let b = 1; b <= 4; b++) {
        const bx = x + (cw * b) / 5;
        ctx.beginPath();
        ctx.moveTo(bx, yy + 2);
        ctx.lineTo(bx, yy + ch - 2);
        ctx.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  solarTexture = t;
  return t;
}
