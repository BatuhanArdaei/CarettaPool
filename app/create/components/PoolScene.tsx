'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  OrbitControls,
  Sky,
  Stars,
} from '@react-three/drei';
import { EffectComposer, Bloom, SMAA, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  POOL_SIDES,
  extensionSidesOf,
  getPanelType,
  isNightScene,
  outdoorLightingOf,
  sidePanelSegments,
  poolEntryOf,
  type CladdingType,
  type FrameColor,
  type GroundType,
  type LightColor,
  type PoolConfig,
  type PoolSide,
  type PlatformDirection,
} from '@/lib/types';
import { CLADDING_TEXTURE_URLS, claddingSceneUrl, claddingTileSize } from '@/lib/claddingTextures';
import { Beam, DeckSurfaceMaterial, GlassMaterial, PowderCoatMaterial, getSolarTexture, getTileMaps, groundAntiTile, groundAntiTileKey } from './materials';

const POOL_HEIGHT = 1.5;
const COPING_T = 0.10;
/**
 * Kenardaki panellerin 3D konumları: standart 2,40 m camlar + kesik cam (sidePanelSegments),
 * frame payı düşülmüş iç açıklığa orantılı yerleştirilir. Merkez 0'dan ölçülür.
 */
function panelBounds(side: PoolSide, config: PoolConfig, innerSpan: number): { start: number; end: number }[] {
  const segs = sidePanelSegments(side, config);
  const total = segs.reduce((a, b) => a + b, 0);
  const k = innerSpan / total;
  let x = -innerSpan / 2;
  return segs.map((len) => {
    const start = x;
    x += len * k;
    return { start, end: x };
  });
}
const PANEL_H  = 1.20;  // fixed panel height in metres
const COPING_W = 0.32;
const FRAME_T = 0.10;
const PANEL_T = 0.04;
/**
 * İç kaplamanın duvar dış yüzünden içeri mesafesi: çerçevenin üst/alt kirişleri (8,5 cm),
 * dikmeler (9 cm) ve köşe kolonları (5 cm) kaplamanın arkasında kalır, havuzun içinden metal görünmez.
 */
const LINER = 0.095;
const BASIN_FLOOR = 0.06;
const PLATFORM_DEPTH = 2.0;
/**
 * Platform merdiveninin dış kenarının platformun havuz tarafındaki kenarına uzaklığı: makine
 * dairesinin dış yüzü. Dış uzatma eklense de merdiven bu konumda kalır.
 */
const STAIR_OUTER = PLATFORM_DEPTH * 0.6;
/**
 * Platformun (makine dairesi + döşeme) havuz boyunca iki uçtaki taşması: kenar döşemesinin dış
 * kenarına kadar (duvardan 27 cm). Havuz kenarı ile platform tek düz hatta biter, içe girinti olmaz.
 */
const PLATFORM_END_EXT = (COPING_W - FRAME_T) / 2 + COPING_W / 2;
/** Rulo kapak tamburunun gizlendiği, tabandan yükselen bölmenin derinliği */
const COVER_BAY_DEPTH = 0.4;
/** Havuz içi merdivenin başındaki, platform yüzeyiyle kaplı sahanlığın derinliği */
const STEP_LANDING_DEPTH = 0.5;
/**
 * Basamak çizgileri: kaplama renginin bu oranda koyusu (antrasit değil, kaplamanın tonu). Işıktan
 * etkilenmeyen malzemeyle çizilir; güneş altında açılıp kaybolmaz.
 */
const STEP_NOSE_SHADE = 0.15; // doğrusal renk uzayında: ekranda kaplama tonunun ~%40'ı

/** Havuz içi basamakların bulunduğu duvar: kısa kenarın + ucu (PoolSteps ile aynı kural) */
function stepsWallSide(w: number, l: number): PoolSide {
  return w / 2 <= l / 2 ? 'south' : 'east';
}
/** Makine dairesinin havalandırmalı dış ön yüzü çerçeve renginden bağımsız, daima antrasit; geri kalanı çerçeve renginde */
const MACHINE_ROOM_COLOR = '#3a3f45';

/**
 * 3D Stüdyo ortamı:
 * - 'studio': sade ürün stüdyosu (sonsuz fon + havuz çevresinde seçilen zemin)
 * - 'garden': prosedürel bahçe (çim, ağaçlar, villa, çit)
 */
const SCENE_STYLE = 'studio' as 'studio' | 'garden';
const STUDIO_BG = '#e3e7eb';
const PLINTH_H = 0.08; // stüdyoda zemin örneğinin kaide kalınlığı

/** Kurulum tipine göre havuzun zemin altına indiği derinlik (metre). */
export function sinkDepth(config: Pick<PoolConfig, 'installation'>): number {
  if (config.installation === 'partial') return POOL_HEIGHT / 2;
  if (config.installation === 'sunken') return POOL_HEIGHT - COPING_T; // kenar ahşabı zemine oturur
  return 0;
}

export interface FootprintRect { minX: number; maxX: number; minZ: number; maxZ: number }

/** Havuz gövdesi + makine dairesinin zemindeki izdüşümü (havuz yerel koordinatları). */
export function poolFootprint(config: PoolConfig): FootprintRect {
  const halfW = config.width / 2;
  const halfL = config.length / 2;
  const cabinet = COPING_W - FRAME_T + PLATFORM_DEPTH * 0.6;
  const r = { minX: -halfW, maxX: halfW, minZ: -halfL, maxZ: halfL };
  if (config.platformDirection === 'east') r.maxX += cabinet;
  else if (config.platformDirection === 'west') r.minX -= cabinet;
  else if (config.platformDirection === 'north') r.minZ -= cabinet;
  else r.maxZ += cabinet;
  // Platform havuz boyunca kenar döşemesi hizasına kadar uzanır
  if (config.platformDirection === 'east' || config.platformDirection === 'west') {
    r.minZ = -halfL - PLATFORM_END_EXT;
    r.maxZ = halfL + PLATFORM_END_EXT;
  } else {
    r.minX = -halfW - PLATFORM_END_EXT;
    r.maxX = halfW + PLATFORM_END_EXT;
  }
  return r;
}

/** Kenar terası derinliği (havuz kenarından dışarıya, metre) */
const SIDE_DECK_DEPTH = PLATFORM_DEPTH;

export interface DeckRect { x1: number; x2: number; z1: number; z2: number }

/**
 * Makine dairesi dışındaki kenar terasları ve bitişik iki terasın arasındaki köşe parçaları
 * (havuz yerel koordinatları). Platformun merdiven köşesi, merdiven varken boş bırakılır.
 */
export function extensionLayout(config: PoolConfig, hasStairs: boolean) {
  const halfW = config.width / 2;
  const halfL = config.length / 2;
  const gap = COPING_W - FRAME_T;
  const dir = config.platformDirection;
  const sides = extensionSidesOf(config);
  const depthOf = (s: PoolSide) =>
    s === dir ? PLATFORM_DEPTH * (config.platformExtension ? 1 : 0.6) : sides.includes(s) ? SIDE_DECK_DEPTH : 0;

  const decks = sides.map((side) => {
    const d = depthOf(side);
    const rect: DeckRect =
      side === 'east'  ? { x1: halfW + gap, x2: halfW + gap + d, z1: -halfL, z2: halfL }
      : side === 'west' ? { x1: -halfW - gap - d, x2: -halfW - gap, z1: -halfL, z2: halfL }
      : side === 'south' ? { x1: -halfW - gap, x2: halfW + gap, z1: halfL + gap, z2: halfL + gap + d }
      : { x1: -halfW - gap, x2: halfW + gap, z1: -halfL - gap - d, z2: -halfL - gap };
    return { side, rect };
  });

  // Merdiven: doğu/batı platformda +Z (güney) köşesinde, kuzey/güney platformda +X (doğu) köşesinde
  const stairCorner = dir === 'east' || dir === 'west' ? `south-${dir}` : `${dir}-east`;
  const corners: { ns: PoolSide; ew: PoolSide; rect: DeckRect }[] = [];
  for (const ns of ['north', 'south'] as PoolSide[]) {
    for (const ew of ['east', 'west'] as PoolSide[]) {
      const dn = depthOf(ns);
      const de = depthOf(ew);
      if (!dn || !de) continue;
      if (hasStairs && `${ns}-${ew}` === stairCorner) continue;
      // Kuzey/güney platform havuz genişliği kadardır; köşe parçası onun ucuna oturur
      const xIn = ns === dir ? halfW + PLATFORM_END_EXT : halfW + gap;
      const zIn = ew === dir ? halfL + PLATFORM_END_EXT : halfL;
      const xs = ew === 'east' ? [xIn, halfW + gap + de] : [-halfW - gap - de, -xIn];
      const zs = ns === 'south' ? [zIn, halfL + gap + dn] : [-halfL - gap - dn, -zIn];
      corners.push({ ns, ew, rect: { x1: xs[0], x2: xs[1], z1: zs[0], z2: zs[1] } });
    }
  }
  return { decks, corners };
}

/** Havuz + makine dairesi + kenar terasları: zemin döşemesi, kamera ve yerleşim için. */
export function layoutFootprint(config: PoolConfig): FootprintRect {
  const r = poolFootprint(config);
  const halfW = config.width / 2;
  const halfL = config.length / 2;
  const gap = COPING_W - FRAME_T;
  const pd = PLATFORM_DEPTH * (config.platformExtension ? 1 : 0.6);
  const dir = config.platformDirection;
  // Platformun tam (uzatmalı) derinliği
  if (dir === 'east') r.maxX = Math.max(r.maxX, halfW + gap + pd);
  else if (dir === 'west') r.minX = Math.min(r.minX, -halfW - gap - pd);
  else if (dir === 'north') r.minZ = Math.min(r.minZ, -halfL - gap - pd);
  else r.maxZ = Math.max(r.maxZ, halfL + gap + pd);
  const { decks, corners } = extensionLayout(config, false);
  for (const { rect } of [...decks, ...corners]) {
    r.minX = Math.min(r.minX, rect.x1);
    r.maxX = Math.max(r.maxX, rect.x2);
    r.minZ = Math.min(r.minZ, rect.z1);
    r.maxZ = Math.max(r.maxZ, rect.z2);
  }
  return r;
}

/**
 * Düz zemin geometrisi (XZ düzlemi, normal +Y); gömülü havuz için dikdörtgen delikli.
 * UV'ler planeGeometry ile aynı (0–1) tutulur, böylece zemin texture tekrarları değişmez.
 */
export function groundGeometry(sizeX: number, sizeZ: number, hole: FootprintRect | null): THREE.BufferGeometry {
  if (!hole) return new THREE.PlaneGeometry(sizeX, sizeZ).rotateX(-Math.PI / 2);
  const hx = sizeX / 2;
  const hz = sizeZ / 2;
  const shape = new THREE.Shape().moveTo(-hx, -hz).lineTo(hx, -hz).lineTo(hx, hz).lineTo(-hx, hz).closePath();
  // Shape düzlemindeki y ekseni, yatırıldıktan sonra -z olur
  shape.holes.push(
    new THREE.Path()
      .moveTo(hole.minX, -hole.maxZ)
      .lineTo(hole.minX, -hole.minZ)
      .lineTo(hole.maxX, -hole.minZ)
      .lineTo(hole.maxX, -hole.maxZ)
      .closePath(),
  );
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + hx) / sizeX, (pos.getY(i) + hz) / sizeZ);
  }
  return g.rotateX(-Math.PI / 2);
}

/** Delik ölçüsü değişmedikçe aynı zemin geometrisini kullanır. */
function useGroundGeometry(sizeX: number, sizeZ: number, hole: FootprintRect | null | undefined) {
  const key = hole ? [hole.minX, hole.maxX, hole.minZ, hole.maxZ].join(',') : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => groundGeometry(sizeX, sizeZ, hole ?? null), [sizeX, sizeZ, key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

// ─── Mobile detection hook ───────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ─── Camera presets (computed per pool size in useCameraFraming) ────────────
type CamPreset = 'front' | 'top' | 'close';

type CamView = { pos: THREE.Vector3; target: THREE.Vector3 };

/** Kamera ön ayarları ve boşta dönüş yörüngesi — havuzun ölçüsüne göre yakın kadraj. */
function useCameraFraming(config: PoolConfig) {
  return useMemo(() => {
    const fp = layoutFootprint(config);
    const sink = sinkDepth(config);
    // Dış merdiven ve çevre için pay
    const sx = fp.maxX - fp.minX + 1.4;
    const sz = fp.maxZ - fp.minZ + 1.4;
    const d = Math.max(sx, sz) * 0.9 + 2.4;
    const ty = Math.max(0.3, (POOL_HEIGHT - sink) * 0.55) + (config.liftDeck ? 0.9 : 0);
    const c = new THREE.Vector3((fp.minX + fp.maxX) / 2, ty, (fp.minZ + fp.maxZ) / 2);
    const front = sx >= sz ? new THREE.Vector3(0, d * 0.3, d) : new THREE.Vector3(d, d * 0.3, 0);
    const presets: Record<CamPreset, CamView> = {
      front: { pos: c.clone().add(front), target: c },
      top:   { pos: c.clone().add(new THREE.Vector3(0, d * 1.45, 0.01)), target: c },
      close: { pos: c.clone().add(new THREE.Vector3(d * 0.6, d * 0.42, d * 0.6)), target: c },
    };
    return { presets, orbit: { radius: d * 0.95, height: ty + d * 0.4, target: c }, maxDistance: d * 2.2 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.width, config.length, config.platformDirection, config.installation, config.liftDeck, config.platformExtension, extensionSidesOf(config).join()]);
}

interface CameraRigProps {
  preset: CamPreset | null;
  onTransitionEnd: () => void;
  orbitControlsRef: React.MutableRefObject<any>;
  presets: Record<CamPreset, CamView>;
}

function CameraRig({ preset, onTransitionEnd, orbitControlsRef, presets }: CameraRigProps) {
  const { camera, invalidate } = useThree();
  const targetPos  = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const animating  = useRef(false);

  // When preset (or the pool size behind it) changes, kick off smooth transition
  useEffect(() => {
    if (!preset) return;
    const p = presets[preset];
    targetPos.current.copy(p.pos);
    targetLook.current.copy(p.target);
    animating.current = true;
    // Disable OrbitControls during transition
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
  }, [preset, presets, orbitControlsRef]);

  useFrame(() => {
    // ── Smooth preset transition ──────────────────────────────────────────
    if (animating.current) {
      camera.position.lerp(targetPos.current, 0.08);
      if (orbitControlsRef.current) {
        const ot: THREE.Vector3 = orbitControlsRef.current.target;
        ot.lerp(targetLook.current, 0.08);
        orbitControlsRef.current.update();
      }
      const distP = camera.position.distanceTo(targetPos.current);
      const distT = orbitControlsRef.current
        ? orbitControlsRef.current.target.distanceTo(targetLook.current)
        : 0;
      if (distP < 0.05 && distT < 0.05) {
        camera.position.copy(targetPos.current);
        if (orbitControlsRef.current) {
          orbitControlsRef.current.target.copy(targetLook.current);
          orbitControlsRef.current.enabled = true;
          orbitControlsRef.current.update();
        }
        animating.current = false;
        onTransitionEnd();
      }
      invalidate();
      return;
    }

  });

  return null;
}

// ─── Camera preset buttons (React UI overlay) ────────────────────────────────
function CameraButtons({ active, onSelect, isMobile }: { active: CamPreset | null; onSelect: (p: CamPreset) => void; isMobile: boolean }) {
  const btns: { key: CamPreset; label: string; mobileLabel: string }[] = [
    { key: 'front', label: 'Önden',   mobileLabel: 'Ön' },
    { key: 'top',   label: 'Tepeden', mobileLabel: 'Üst' },
    { key: 'close', label: 'Yakın',   mobileLabel: 'Yakın' },
  ];
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      right: isMobile ? 8 : 16,
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? 4 : 6,
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      {btns.map(({ key, label, mobileLabel }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          style={{
            pointerEvents: 'all',
            background: active === key ? 'rgba(14,116,144,0.85)' : 'rgba(0,0,0,0.55)',
            color: '#fff',
            border: active === key ? '1.5px solid #22d3ee' : '1.5px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            padding: isMobile ? '10px 14px' : '5px 14px',
            minHeight: 44,
            minWidth: 44,
            fontSize: isMobile ? 13 : 12,
            fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            transition: 'background 0.2s, border 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          {isMobile ? mobileLabel : label}
        </button>
      ))}
    </div>
  );
}

/**
 * Drives the render loop at a capped FPS while something is animating
 * (water surface, caustics, RGB/dual lighting). Under frameloop="demand"
 * this replaces per-frame invalidate() calls so we render ~30fps instead of
 * an uncapped 60fps — roughly halving idle GPU load while staying smooth.
 * Browsers throttle setInterval in hidden tabs, so it also pauses in background.
 */
function AnimationTicker({ active, fps = 30 }: { active: boolean; fps?: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(id);
  }, [active, fps, invalidate]);
  return null;
}

/** Fires invalidate() whenever config changes so demand rendering picks it up. */
function ConfigInvalidator({ config }: { config: PoolConfig }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, [config, invalidate]);
  return null;
}

/** Traverse the entire scene and enable castShadow + receiveShadow on every mesh. */
export default function PoolScene({
  config,
  controlsRef,
}: {
  config: PoolConfig;
  controlsRef?: React.MutableRefObject<{ reset: () => void } | null>;
}) {
  const isNight = isNightScene(config);
  const isMobile = useIsMobile();
  const [activePreset, setActivePreset] = useState<CamPreset | null>('close');
  const framing = useCameraFraming(config);
  const internalControlsRef = useRef<any>(null);
  const orbitRef = (controlsRef ?? internalControlsRef) as React.MutableRefObject<any>;

  const handlePreset = useCallback((p: CamPreset) => { setActivePreset(p); }, []);
  const handleTransitionEnd = useCallback(() => { /* preset stays highlighted */ }, []);
  const gardenHole = sinkDepth(config) > 0 ? poolFootprint(config) : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <CameraButtons active={activePreset} onSelect={handlePreset} isMobile={isMobile} />
      <Canvas
      frameloop="demand"
      camera={{ position: [12, 7.5, 20], fov: 50 }}
      dpr={isMobile ? [1, 1] : [1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        // PBR Neutral: ürün renklerini (RAL) bozmadan fotoğrafik ton eşleme
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <Suspense fallback={null}>
        {isNight ? (
          <>
            {/* Moonlit night — dark blue sky + stars + bright moonlight */}
            <color attach="background" args={['#0d1428']} />
            <fog attach="fog" args={['#162237', 25, 75]} />
            <Stars
              radius={120}
              depth={50}
              count={2500}
              factor={3.2}
              saturation={0}
              fade
              speed={0.3}
            />
            {/* Hemisphere light gives a soft moonlit ambient (sky vs ground) */}
            <hemisphereLight color="#9eb5e6" groundColor="#1a2240" intensity={0.4} />
            <ambientLight intensity={0.18} color="#5a6e9e" />
            {/* Moonlight — main directional, cool blue-white, brighter */}
            <directionalLight
              position={[8, 22, 6]}
              intensity={0.85}
              color="#dbe8ff"
            />
            {/* Soft fill from opposite side */}
            <directionalLight position={[-12, 8, -10]} intensity={0.18} color="#8ea4cc" />
          </>
        ) : (
          <>
            {SCENE_STYLE === 'garden' ? (
              <Sky sunPosition={[5, 10, 5]} turbidity={1.5} rayleigh={0.8} />
            ) : (
              <color attach="background" args={[STUDIO_BG]} />
            )}
            <ambientLight color="#87CEEB" intensity={0.12} />
            {/* Sun directional light — clear afternoon sun */}
            <directionalLight
              position={[8, 12, 6]}
              intensity={1.5}
              color="#FFF8F0"
            />
            {/* Visible sun disk in the sky */}
            {SCENE_STYLE === 'garden' && (<>
            <mesh position={[50, 100, 50]}>
              <sphereGeometry args={[7, 24, 24]} />
              <meshBasicMaterial color="#fff8d6" toneMapped={false} />
            </mesh>
            {/* Soft halo around the sun */}
            <mesh position={[50, 100, 50]}>
              <sphereGeometry args={[10, 16, 16]} />
              <meshBasicMaterial
                color="#ffe8a0"
                transparent
                opacity={0.35}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
            </>)}
          </>
        )}
        {/* Environment IBL — real HDR for daytime, night preset for night mode */}
        {isNight ? (
          <Environment files="/hdr/dikhololo_night_1k.hdr" background={false} />
        ) : (
          <Environment
            files="/hdr/outdoor_umbrellas_1k.hdr"
            background={false}
          />
        )}
        {SCENE_STYLE === 'garden' ? (
          <>
            <Garden isNight={isNight} hole={gardenHole} />
            <Trees isNight={isNight} isMobile={isMobile} />
            <VillaSlot isNight={isNight} />
            <Fence isNight={isNight} />
          </>
        ) : (
          <StudioFloor isNight={isNight} hole={gardenHole} />
        )}
        <Pool config={config} isNight={isNight} groundPatch={SCENE_STYLE === 'studio' ? 'plinth' : 'auto'} />
        <OrbitControls
          ref={orbitRef}
          enablePan
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.05}
          minDistance={2.5}
          maxDistance={framing.maxDistance}
          maxPolarAngle={Math.PI / 2.05}
          target={framing.orbit.target}
        />
        <CameraRig
          preset={activePreset}
          onTransitionEnd={handleTransitionEnd}
          orbitControlsRef={orbitRef}
          presets={framing.presets}
        />
        {/* Invalidate on config change so demand-rendering stays in sync */}
        <ConfigInvalidator config={config} />
        {/* Cap animated rendering to ~30fps while water/lighting animate */}
        <AnimationTicker active={config.showWater || config.lighting.enabled} />

        {/* Post-processing — disabled on mobile for performance */}
        {!isMobile && (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={isNight ? 1.2 : 0.45}
              luminanceThreshold={isNight ? 0.18 : 0.88}
              luminanceSmoothing={0.2}
              mipmapBlur
              kernelSize={KernelSize.MEDIUM}
            />
            <Vignette
              offset={0.3}
              darkness={isNight ? 0.55 : 0.32}
              blendFunction={BlendFunction.NORMAL}
            />
            <SMAA />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
    </div>
  );
}

/* ── Procedural ground textures (canvas-based, no external files needed) ── */
function buildGroundTex(type: GroundType, isNight: boolean): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  const rng = (n = 1) => Math.random() * n;

  if (type === 'gravel') {
    // Dense small pebbles — base sandy colour
    c.fillStyle = isNight ? '#3a3028' : '#c8b898';
    c.fillRect(0, 0, S, S);
    // 700 small stones (2-7 px radius)
    for (let i = 0; i < 700; i++) {
      const x = rng(S), y = rng(S);
      const rx = 2 + rng(5), ry = 1.5 + rng(4);
      const angle = rng(Math.PI);
      const base = isNight ? 50 + rng(40) : 130 + rng(80);
      c.beginPath();
      c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
      c.fillStyle = `rgb(${base},${base - 5},${base - 10})`;
      c.fill();
      // top-left highlight
      c.beginPath();
      c.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.45, ry * 0.4, angle, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.fill();
      // bottom-right shadow
      c.beginPath();
      c.ellipse(x + rx * 0.25, y + ry * 0.25, rx * 0.5, ry * 0.45, angle, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.fill();
    }

  } else if (type === 'wood') {
    const plankH = 38;
    const baseColors = isNight
      ? [[48, 32, 14], [42, 28, 10], [54, 36, 16]]
      : [[185, 118, 52], [170, 108, 44], [195, 128, 58]];
    let row = 0;
    for (let y0 = 0; y0 < S; y0 += plankH, row++) {
      const [r, g, b] = baseColors[row % baseColors.length];
      const dv = (rng() - 0.5) * 18;
      c.fillStyle = `rgb(${r + dv},${g + dv / 2},${b + dv / 3})`;
      c.fillRect(0, y0, S, plankH - 2);
      // wood grain lines (wavy, subtle)
      for (let gi = 0; gi < 12; gi++) {
        const gy = y0 + (plankH / 12) * gi;
        c.beginPath();
        c.moveTo(0, gy);
        for (let x = 0; x <= S; x += 6) {
          c.lineTo(x, gy + Math.sin((x + row * 53) / 22) * 1.5 + (rng() - 0.5) * 0.5);
        }
        c.strokeStyle = `rgba(0,0,0,${0.04 + rng() * 0.04})`;
        c.lineWidth = 0.7;
        c.stroke();
      }
      // plank gap
      c.fillStyle = isNight ? '#12080200' : '#3a1e0a';
      c.fillStyle = isNight ? '#1a0c04' : '#3a1e0a';
      c.fillRect(0, y0 + plankH - 2, S, 2);
    }

  } else if (type === 'grass') {
    // Clean uniform green base
    c.fillStyle = isNight ? '#1a3416' : '#3d7a2e';
    c.fillRect(0, 0, S, S);
    // Very subtle color variation — small, low-contrast dots only
    for (let i = 0; i < 200; i++) {
      const x = rng(S), y = rng(S), r = 2 + rng(6);
      const bright = rng() > 0.5;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = bright ? 'rgba(90,160,55,0.1)' : 'rgba(20,55,15,0.1)';
      c.fill();
    }
    // Fine grass texture — short uniform blades
    for (let i = 0; i < 600; i++) {
      const x = rng(S), y = rng(S);
      const len = 2 + rng(5);
      const a = -Math.PI * 0.5 + (rng() - 0.5) * 0.8;
      const g = isNight ? 50 + rng(20) : 95 + rng(40);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      c.strokeStyle = `rgba(${isNight ? 15 : 35},${g},${isNight ? 12 : 20},0.5)`;
      c.lineWidth = 1;
      c.stroke();
    }

  } else {
    // Concrete — smooth with fine surface and clear expansion joints
    const base = isNight ? 60 : 185;
    c.fillStyle = `rgb(${base},${base},${base - 4})`;
    c.fillRect(0, 0, S, S);
    // Fine surface texture (subtle)
    for (let i = 0; i < 2500; i++) {
      const v = isNight ? base - 12 + rng(24) : base - 20 + rng(40);
      c.fillStyle = `rgba(${v},${v},${v},0.35)`;
      c.fillRect(rng(S), rng(S), 1 + rng(2), 1 + rng(2));
    }
    // Expansion joints every 128 px — clear, dark lines
    const jS = 128;
    c.strokeStyle = isNight ? '#282828' : '#909088';
    c.lineWidth = 2;
    for (let x = jS; x < S; x += jS) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, S); c.stroke(); }
    for (let y = jS; y < S; y += jS) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); }
    // Inner highlight (very subtle slab differentiation)
    c.strokeStyle = isNight ? '#484848' : '#d0d0cc';
    c.lineWidth = 0.5;
    for (let x = jS; x < S; x += jS) { c.beginPath(); c.moveTo(x + 2, 0); c.lineTo(x + 2, S); c.stroke(); }
    for (let y = jS; y < S; y += jS) { c.beginPath(); c.moveTo(0, y + 2); c.lineTo(S, y + 2); c.stroke(); }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Zemin dokuları (yerel) ve gerçek boyutları — tekrar sayısı yüzey boyutundan hesaplanır. */
const GROUND_IMG: Record<GroundType, string> = {
  gravel:   '/textures/graveltexture.jpg',
  wood:     '/textures/pbr/wood_deck/diff.webp', // kenar/platform ile aynı ahşap
  grass:    '/textures/pbr/grass/diff.webp',
  concrete: '/textures/concretetexture.jpg',
};

/** Normal map URLs for ground types that have them */
const GROUND_NORMAL_IMG: Partial<Record<GroundType, string>> = {
  grass: '/textures/pbr/grass/nor_gl.webp',
  wood:  '/textures/pbr/wood_deck/nor_gl.webp',
};

/** Bir doku tekrarının gerçek dünyadaki boyutu (metre) */
const GROUND_TILE_M: Record<GroundType, number> = { grass: 1, wood: 1.8, gravel: 1.2, concrete: 3 };

/* İndirilen zemin dokuları bir kez yüklenir; her kullanım yalnızca klonlanır (GPU belleği paylaşılır). */
const groundTexCache = new Map<string, THREE.Texture>();
const groundTexLoading = new Map<string, Promise<THREE.Texture>>();

function loadGroundTexture(url: string, srgb: boolean): Promise<THREE.Texture> {
  const hit = groundTexCache.get(url);
  if (hit) return Promise.resolve(hit);
  let p = groundTexLoading.get(url);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      groundTexCache.set(url, t);
      groundTexLoading.delete(url);
      return t;
    });
    groundTexLoading.set(url, p);
  }
  return p;
}

/** Yüklenen dokunun, verilen yüzey boyutuna göre ölçeklenmiş klonu. */
function useScaledGroundTexture(
  url: string | undefined,
  srgb: boolean,
  type: GroundType,
  sizeX: number,
  sizeZ: number,
): THREE.Texture | null {
  const invalidate = useThree((s) => s.invalidate);
  const [base, setBase] = useState<THREE.Texture | null>(() => (url ? groundTexCache.get(url) ?? null : null));

  useEffect(() => {
    if (!url) { setBase(null); return; }
    const hit = groundTexCache.get(url);
    if (hit) { setBase(hit); return; }
    let active = true;
    loadGroundTexture(url, srgb).then((t) => { if (active) setBase(t); });
    return () => { active = false; };
  }, [url, srgb]);

  const scaled = useMemo(() => {
    if (!base) return null;
    const t = base.clone();
    t.repeat.set(sizeX / GROUND_TILE_M[type], sizeZ / GROUND_TILE_M[type]);
    t.needsUpdate = true;
    return t;
  }, [base, type, sizeX, sizeZ]);

  useEffect(() => { invalidate(); return () => scaled?.dispose(); }, [scaled, invalidate]);
  return scaled;
}

function useGroundTex(type: GroundType, isNight: boolean, sizeX: number, sizeZ: number): THREE.Texture {
  // Fotoğraf dokusu ilk kez inerken gösterilen prosedürel yedek
  const canvasTex = useMemo(() => {
    if (typeof document === 'undefined') return new THREE.Texture();
    const ct = buildGroundTex(type, isNight);
    ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
    ct.colorSpace = THREE.SRGBColorSpace;
    ct.repeat.set(sizeX / 3.3, sizeZ / 3.3);
    return ct;
  }, [type, isNight, sizeX, sizeZ]);
  useEffect(() => () => canvasTex.dispose(), [canvasTex]);

  const photoTex = useScaledGroundTexture(GROUND_IMG[type], true, type, sizeX, sizeZ);
  return photoTex ?? canvasTex;
}

function useGroundNormalTex(type: GroundType, sizeX: number, sizeZ: number): THREE.Texture | null {
  return useScaledGroundTexture(GROUND_NORMAL_IMG[type], false, type, sizeX, sizeZ);
}

/**
 * Sonsuz stüdyo fonu: zemin görünmezdir, yalnızca gölgeleri gösterir.
 * Arka plan düz renk olduğu için ufuk çizgisi oluşmaz (ürün stüdyosu).
 */
function StudioFloor({ isNight, hole }: { isNight: boolean; hole?: FootprintRect | null }) {
  const geometry = useGroundGeometry(200, 200, hole);
  return (
    <mesh geometry={geometry} position={[0, -PLINTH_H, 0]} receiveShadow>
      <shadowMaterial opacity={isNight ? 0.5 : 0.22} />
    </mesh>
  );
}

function Garden({ isNight, hole }: { isNight: boolean; hole?: FootprintRect | null }) {
  // Garden is always grass — ground selection only affects pool interior cladding
  const tex = useGroundTex('grass', isNight, 120, 120);
  const normalTex = useGroundNormalTex('grass', 120, 120);
  const geometry = useGroundGeometry(120, 120, hole);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        key={tex.uuid}
        map={tex}
        normalMap={normalTex ?? undefined}
        normalScale={normalTex ? new THREE.Vector2(0.8, 0.8) : new THREE.Vector2(1, 1)}
          onBeforeCompile={groundAntiTile}
          customProgramCacheKey={groundAntiTileKey}
        color="#c8e888"
        roughness={0.92}
        metalness={0}
        envMapIntensity={0.3}
      />
    </mesh>
  );
}

function PoolDeck({
  footprint,
  ground,
  isNight,
  hole,
  soft = false,
  margin = 2.5,
}: {
  /** Döşemenin oturduğu alan; döşeme bunun her yanına `margin` kadar taşar */
  footprint: FootprintRect;
  ground: GroundType;
  isNight: boolean;
  hole?: FootprintRect | null;
  /** Stüdyo ortamı: kenar profili yerine koyu renkli kaide (maket tabanı gibi) */
  soft?: boolean;
  /** Havuzun çevresindeki döşeme genişliği (metre) */
  margin?: number;
}) {
  // Döşeme izdüşüme göre ortalanır: delik her zaman döşemenin içinde kalır
  const deckW = footprint.maxX - footprint.minX + margin * 2;
  const deckL = footprint.maxZ - footprint.minZ + margin * 2;
  const cx = (footprint.minX + footprint.maxX) / 2;
  const cz = (footprint.minZ + footprint.maxZ) / 2;
  // Delik döşemenin içinde kalacak şekilde kırpılır (makine dairesi tarafında döşeme havuz duvarında biter)
  const localHole = useMemo(() => {
    if (!hole) return null;
    const e = 0.002;
    const hx = deckW / 2 - e;
    const hz = deckL / 2 - e;
    return {
      minX: Math.max(hole.minX - cx, -hx), maxX: Math.min(hole.maxX - cx, hx),
      minZ: Math.max(hole.minZ - cz, -hz), maxZ: Math.min(hole.maxZ - cz, hz),
    };
  }, [hole, cx, cz, deckW, deckL]);
  const edgeH = 0.025; // 2.5 cm high kerb
  const edgeT = 0.04;  // 4 cm thick
  const tex = useGroundTex(ground, isNight, deckW, deckL);
  const normalTex = useGroundNormalTex(ground, deckW, deckL);

  const matProps: Record<GroundType, { color: string; roughness: number; metalness: number }> = {
    grass:    { color: '#b7cc92', roughness: 0.95, metalness: 0 },
    gravel:   { color: '#b8a898', roughness: 0.95, metalness: 0 },
    concrete: { color: '#d0ccc4', roughness: 0.80, metalness: 0.02 },
    wood:     { color: '#ffffff', roughness: 0.75, metalness: 0 },
  };
  const mat = matProps[ground] ?? matProps.concrete;
  const geometry = useGroundGeometry(deckW, deckL, localHole);

  return (
    <group position={[cx, 0, cz]}>
      {/* Deck surface — material follows ground type selection */}
      <mesh geometry={geometry} position={[0, 0.01, 0]} receiveShadow>
        <meshStandardMaterial
          key={tex.uuid}
          map={tex}
          normalMap={normalTex ?? undefined}
          normalScale={normalTex ? new THREE.Vector2(0.8, 0.8) : new THREE.Vector2(1, 1)}
          onBeforeCompile={groundAntiTile}
          customProgramCacheKey={groundAntiTileKey}
          color={mat.color}
          roughness={mat.roughness}
          metalness={mat.metalness}
          envMapIntensity={0.3}
        />
      </mesh>
      {/* Edge profiles — dark gray kerb separating deck from grass */}
      {!soft && (<>
      <mesh position={[0, edgeH / 2, deckL / 2 + edgeT / 2]} castShadow receiveShadow>
        <boxGeometry args={[deckW + edgeT * 2, edgeH, edgeT]} />
        <meshStandardMaterial color="#3c3c3c" roughness={0.9} />
      </mesh>
      <mesh position={[0, edgeH / 2, -(deckL / 2 + edgeT / 2)]} castShadow receiveShadow>
        <boxGeometry args={[deckW + edgeT * 2, edgeH, edgeT]} />
        <meshStandardMaterial color="#3c3c3c" roughness={0.9} />
      </mesh>
      <mesh position={[deckW / 2 + edgeT / 2, edgeH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[edgeT, edgeH, deckL]} />
        <meshStandardMaterial color="#3c3c3c" roughness={0.9} />
      </mesh>
      <mesh position={[-(deckW / 2 + edgeT / 2), edgeH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[edgeT, edgeH, deckL]} />
        <meshStandardMaterial color="#3c3c3c" roughness={0.9} />
      </mesh>
      </>)}
      {/* Stüdyo kaidesi: zemin örneğinin koyu yan yüzleri (içi boş; gömülü havuz deliğini kapatmaz) */}
      {soft && ([
        { args: [deckW, PLINTH_H, 0.04], pos: [0, 0, deckL / 2 - 0.02] },
        { args: [deckW, PLINTH_H, 0.04], pos: [0, 0, -deckL / 2 + 0.02] },
        { args: [0.04, PLINTH_H, deckL], pos: [deckW / 2 - 0.02, 0, 0] },
        { args: [0.04, PLINTH_H, deckL], pos: [-deckW / 2 + 0.02, 0, 0] },
      ] as { args: [number, number, number]; pos: [number, number, number] }[]).map((side, i) => (
        <Beam key={i} args={side.args} radius={0.008} position={[side.pos[0], -PLINTH_H / 2 + 0.008, side.pos[2]]} castShadow receiveShadow>
          <PowderCoatMaterial color={isNight ? '#1b2029' : '#3d434a'} roughness={0.8} metalness={0.05} />
        </Beam>
      ))}
    </group>
  );
}

// Per-tree sphere offsets (x, y, z, radius) relative to trunk top
const SPHERE_OFFSETS: [number, number, number, number][] = [
  [0,    3.2, 0,    1.25],
  [0.7,  2.7, 0.5, 0.90],
  [-0.8, 2.9, -0.4, 0.95],
  [0.4,  4.0, -0.6, 0.80],
  [-0.5, 3.8,  0.6, 0.75],
  [0.1,  4.8,  0.1, 0.62],
  [-0.3, 2.2,  0.9, 0.68],
];

function Trees({ isNight, isMobile }: { isNight: boolean; isMobile: boolean }) {
  // Villa is at [0,0,-22]. Keep trees at least 13 units away in X when near house Z range.
  const treeData = useMemo<Array<{ pos: [number, number, number]; rot: number; scale: number }>>(() => [
    // Far left beside house
    { pos: [-18, 0, -20], rot:  0.30, scale: 1.10 },
    { pos: [-18, 0, -26], rot: -0.20, scale: 1.00 },
    // Far right beside house
    { pos: [ 18, 0, -20], rot: -0.45, scale: 0.95 },
    { pos: [ 18, 0, -26], rot:  0.60, scale: 1.05 },
    // Garden sides (in front, well clear of house)
    { pos: [-20, 0, -6],  rot: -0.60, scale: 0.90 },
    { pos: [ 20, 0, -5],  rot:  0.20, scale: 1.00 },
    { pos: [-20, 0,  4],  rot:  0.55, scale: 0.85 },
    { pos: [ 20, 0,  5],  rot: -0.35, scale: 0.95 },
    // Far background
    { pos: [-17, 0, -34], rot: -0.15, scale: 0.80 },
    { pos: [ 17, 0, -34], rot:  0.90, scale: 1.08 },
  ], []);

  // Mobile: show only 4 symmetrical trees to reduce draw calls
  const visibleTrees = isMobile ? treeData.filter((_, i) => [0, 2, 4, 5].includes(i)) : treeData;

  const trunkColor = isNight ? '#1a0e06' : '#4a2f1a';
  const leafPalette = isNight
    ? ['#0a200a', '#0c2810', '#0f2e12', '#0d2a0e', '#122e12', '#0e2c10', '#102a0e']
    : ['#1e4d12', '#2d5a1b', '#245218', '#284e16', '#1e4a14', '#266018', '#224c16'];

  return (
    <group>
      {visibleTrees.map(({ pos, rot, scale }, ti) => (
        <group key={ti} position={pos} rotation={[0, rot, 0]} scale={[scale, scale, scale]}>
          {/* Trunk */}
          <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.12, 0.20, 1.8, 10]} />
            <meshStandardMaterial color={trunkColor} roughness={0.96} />
          </mesh>
          {/* Sphere cluster foliage */}
          {SPHERE_OFFSETS.map(([sx, sy, sz, sr], si) => (
            <mesh key={si} castShadow receiveShadow position={[sx, sy, sz]}>
              <sphereGeometry args={[sr, 10, 10]} />
              <meshStandardMaterial
                color={leafPalette[(ti * 3 + si) % leafPalette.length]}
                roughness={1.0}
                metalness={0}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ModernVilla({ isNight }: { isNight: boolean }) {
  const plaster  = isNight ? '#8e8a82' : '#f2ece0';
  const plasterD = isNight ? '#706c65' : '#dfd9cc';
  const roof     = isNight ? '#28282a' : '#343436';
  const frame    = isNight ? '#0a0c0e' : '#16181c';
  const glass    = '#1a3050';
  const glassOp  = isNight ? 0.75 : 0.55;
  const litCol   = isNight ? '#f5cd70' : '#000';
  const litEm    = isNight ? 0.55 : 0;

  const [plasterTex, setPlasterTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let active = true;
    new THREE.TextureLoader().load(
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plaster_wall/plaster_wall_diff_1k.jpg',
      (t) => {
        if (!active) return;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(6, 2);
        t.anisotropy = 8;
        setPlasterTex(t);
      }
    );
    return () => { active = false; };
  }, []);

  const wallMat = { map: plasterTex ?? undefined, color: plaster, roughness: 0.88, metalness: 0 as number };
  const frameMat = { color: frame, roughness: 0.25, metalness: 0.65 as number };
  const glassMat = { color: glass, transparent: true as const, opacity: glassOp, roughness: 0.04, metalness: 0.15 as number };

  // === Main block ===
  const MW = 17; const MD = 7; const GH = 3.6; const UH = 3.5;
  const TH = GH + UH;

  return (
    <group position={[0, 0, -20]}>

      {/* ── MAIN BLOCK ── */}
      {/* Back wall */}
      <mesh castShadow receiveShadow position={[0, TH / 2, -MD / 2]}>
        <boxGeometry args={[MW, TH, 0.32]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Left side wall */}
      <mesh castShadow receiveShadow position={[-MW / 2, TH / 2, 0]}>
        <boxGeometry args={[0.32, TH, MD]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Right side wall */}
      <mesh castShadow receiveShadow position={[MW / 2, TH / 2, 0]}>
        <boxGeometry args={[0.32, TH, MD]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Mid-floor slab (visible overhang line) */}
      <mesh receiveShadow position={[0, GH + 0.12, 0]}>
        <boxGeometry args={[MW + 0.1, 0.24, MD + 0.1]} />
        <meshStandardMaterial color={plasterD} roughness={0.8} />
      </mesh>

      {/* ── GROUND-FLOOR FACADE (pool-facing) ── */}
      {/* Left solid panel */}
      <mesh castShadow receiveShadow position={[-MW / 2 + 1.6, GH / 2, MD / 2]}>
        <boxGeometry args={[3.2, GH, 0.32]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Right solid panel */}
      <mesh castShadow receiveShadow position={[MW / 2 - 1.1, GH / 2, MD / 2]}>
        <boxGeometry args={[2.2, GH, 0.32]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Large glass wall (centre) */}
      <mesh position={[0.8, GH / 2, MD / 2 + 0.07]}>
        <boxGeometry args={[10.6, GH - 0.14, 0.07]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>
      {/* Frame — top beam */}
      <mesh position={[0.8, GH - 0.12, MD / 2]}>
        <boxGeometry args={[11, 0.22, 0.22]} />
        <meshStandardMaterial {...frameMat} />
      </mesh>
      {/* Frame — bottom sill */}
      <mesh position={[0.8, 0.12, MD / 2]}>
        <boxGeometry args={[11, 0.22, 0.24]} />
        <meshStandardMaterial {...frameMat} />
      </mesh>
      {/* Vertical mullions */}
      {([-4.7, -1.5, 1.8, 5.1] as number[]).map((x, i) => (
        <mesh key={i} position={[x + 0.8, GH / 2, MD / 2]}>
          <boxGeometry args={[0.09, GH, 0.22]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
      ))}

      {/* ── UPPER-FLOOR FACADE ── */}
      {/* Left solid */}
      <mesh castShadow receiveShadow position={[-MW / 2 + 2.1, GH + UH / 2, MD / 2]}>
        <boxGeometry args={[4.2, UH, 0.32]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Left window */}
      <mesh position={[-2.8, GH + UH / 2, MD / 2 + 0.07]}>
        <boxGeometry args={[4.6, UH - 0.5, 0.07]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>
      {/* Centre divider */}
      <mesh castShadow receiveShadow position={[0.4, GH + UH / 2, MD / 2]}>
        <boxGeometry args={[1.6, UH, 0.32]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Right window */}
      <mesh position={[5.2, GH + UH / 2, MD / 2 + 0.07]}>
        <boxGeometry args={[6.2, UH - 0.5, 0.07]} />
        <meshStandardMaterial {...glassMat} />
      </mesh>
      {/* Right solid */}
      <mesh castShadow receiveShadow position={[MW / 2 - 1, GH + UH / 2, MD / 2]}>
        <boxGeometry args={[2, UH, 0.32]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {/* Upper frame beams */}
      <mesh position={[0, GH + 0.14, MD / 2]}>
        <boxGeometry args={[MW, 0.22, 0.22]} />
        <meshStandardMaterial {...frameMat} />
      </mesh>
      <mesh position={[0, GH + UH - 0.12, MD / 2]}>
        <boxGeometry args={[MW, 0.22, 0.22]} />
        <meshStandardMaterial {...frameMat} />
      </mesh>

      {/* ── FLAT ROOF ── */}
      <mesh castShadow receiveShadow position={[0, TH + 0.2, 0]}>
        <boxGeometry args={[MW + 0.5, 0.4, MD + 0.5]} />
        <meshStandardMaterial color={roof} roughness={0.85} />
      </mesh>
      {/* Roof parapet (front) */}
      <mesh castShadow position={[0, TH + 0.65, MD / 2 + 0.25]}>
        <boxGeometry args={[MW + 0.5, 0.6, 0.28]} />
        <meshStandardMaterial color={plaster} roughness={0.88} />
      </mesh>
      {/* Parapet cap */}
      <mesh position={[0, TH + 0.97, MD / 2 + 0.25]}>
        <boxGeometry args={[MW + 0.5, 0.1, 0.36]} />
        <meshStandardMaterial color={plasterD} roughness={0.65} />
      </mesh>

      {/* ── LEFT WING (single story) ── */}
      <group position={[-MW / 2 - 4.5, 0, -0.5]}>
        <mesh castShadow receiveShadow position={[0, GH / 2, 0]}>
          <boxGeometry args={[9, GH, 6]} />
          <meshStandardMaterial {...wallMat} />
        </mesh>
        {/* Wing pool-facing window */}
        <mesh position={[0, GH / 2, 3.07]}>
          <boxGeometry args={[5.5, GH - 0.5, 0.07]} />
          <meshStandardMaterial {...glassMat} />
        </mesh>
        <mesh position={[0, GH - 0.12, 3]}>
          <boxGeometry args={[5.8, 0.22, 0.22]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
        <mesh position={[0, 0.12, 3]}>
          <boxGeometry args={[5.8, 0.22, 0.24]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
        {/* Wing flat roof */}
        <mesh castShadow position={[0, GH + 0.2, 0]}>
          <boxGeometry args={[9.4, 0.4, 6.4]} />
          <meshStandardMaterial color={roof} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, GH + 0.65, 3.2]}>
          <boxGeometry args={[9.4, 0.6, 0.28]} />
          <meshStandardMaterial color={plaster} roughness={0.88} />
        </mesh>
      </group>

      {/* ── TERRACE SLAB (connects villa to pool area) ── */}
      <mesh receiveShadow position={[0, 0.025, MD / 2 + 3.5]}>
        <boxGeometry args={[MW, 0.05, 7]} />
        <meshStandardMaterial color={isNight ? '#2c2a28' : '#c8c4b8'} roughness={0.88} />
      </mesh>

      {/* Interior warm-light emissive planes (night) */}
      {[
        { x:  0.8, y: GH / 2,       z: MD / 2 - 0.15, w: 10.2, h: GH - 0.2 },
        { x: -2.8, y: GH + UH / 2,  z: MD / 2 - 0.15, w:  4.3, h: UH - 0.5 },
        { x:  5.2, y: GH + UH / 2,  z: MD / 2 - 0.15, w:  5.8, h: UH - 0.5 },
      ].map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} rotation={[0, 0, 0]}>
          <planeGeometry args={[p.w, p.h]} />
          <meshStandardMaterial
            color={litCol}
            emissive={litCol}
            emissiveIntensity={litEm}
            side={THREE.BackSide}
            transparent
            opacity={litEm > 0 ? 0.9 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

function Loungers({ w, l }: { w: number; l: number }) {
  const halfW = w / 2;
  const halfL = l / 2;
  const bedColor = '#f5f0e8';
  const frameColor = '#c8b89a';
  const cushionColor = '#e8dfd0';

  return (
    <group>
      {/* Lounger 1 — north side of pool, slight angle */}
      <group position={[halfW + 1.6, 0, -halfL * 0.3]} rotation={[0, -0.25, 0]}>
        <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.7, 0.12, 2.0]} />
          <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.32, 0]} receiveShadow>
          <boxGeometry args={[0.62, 0.1, 1.9]} />
          <meshStandardMaterial color={cushionColor} roughness={0.8} />
        </mesh>
        {/* Headrest raised */}
        <mesh position={[0, 0.38, -0.78]} receiveShadow>
          <boxGeometry args={[0.62, 0.12, 0.42]} />
          <meshStandardMaterial color={bedColor} roughness={0.8} />
        </mesh>
        {/* Legs */}
        {[[-0.28, 0], [0.28, 0], [-0.28, 1], [0.28, 1]].map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.1, lz - 0.5]}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 6]} />
            <meshStandardMaterial color={frameColor} metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
      </group>
      {/* Lounger 2 — parallel */}
      <group position={[halfW + 1.6, 0, halfL * 0.3]} rotation={[0, 0.15, 0]}>
        <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.7, 0.12, 2.0]} />
          <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.32, 0]} receiveShadow>
          <boxGeometry args={[0.62, 0.1, 1.9]} />
          <meshStandardMaterial color={cushionColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.38, -0.78]} receiveShadow>
          <boxGeometry args={[0.62, 0.12, 0.42]} />
          <meshStandardMaterial color={bedColor} roughness={0.8} />
        </mesh>
        {[[-0.28, 0], [0.28, 0], [-0.28, 1], [0.28, 1]].map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.1, lz - 0.5]}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 6]} />
            <meshStandardMaterial color={frameColor} metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function FlowerPots() {
  const spots: [number, number, number][] = [
    [-12, 0, -19.5],
    [-5, 0, -19.5],
    [6, 0, -19.5],
  ];
  return (
    <group>
      {spots.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Pot */}
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.25, 0.18, 0.44, 10]} />
            <meshStandardMaterial color="#c87850" roughness={0.9} />
          </mesh>
          {/* Soil */}
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.06, 10]} />
            <meshStandardMaterial color="#3a2510" roughness={1} />
          </mesh>
          {/* Plant (sphere cluster) */}
          <mesh position={[0, 0.8 + (i % 2) * 0.15, 0]} castShadow>
            <sphereGeometry args={[0.28 + (i * 0.04) % 0.12, 10, 10]} />
            <meshStandardMaterial color="#1e5a1e" roughness={0.9} />
          </mesh>
          <mesh position={[0.12, 0.72 + (i % 2) * 0.1, 0.1]} castShadow>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#236924" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function VillaSlot({ isNight }: { isNight: boolean }) {
  // Tries to load `/models/villa.glb`. If the file is missing/unreachable,
  // gracefully falls back to the procedural <Villa> below.
  const [glbScene, setGlbScene] = useState<THREE.Group | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(
      '/models/villa.glb',
      (gltf) => {
        if (cancelled) return;
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        setGlbScene(gltf.scene);
        setTried(true);
      },
      undefined,
      () => {
        if (cancelled) return;
        setGlbScene(null);
        setTried(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (glbScene) {
    // Adjust these defaults for the specific GLB you ship.
    return (
      <primitive
        object={glbScene}
        position={[0, 0, -22]}
        rotation={[0, 0, 0]}
        scale={1}
      />
    );
  }
  // Render the procedural villa until/unless a GLB is found.
  if (!tried) return null; // wait for the load attempt before showing fallback
  return <Villa isNight={isNight} />;
}

function Villa({ isNight }: { isNight: boolean }) {
  // Modern flat-roof concrete duplex with cantilevered upper floor and glass facade.
  const concrete = isNight ? '#7d7b73' : '#d8d6cb';
  const concreteDark = isNight ? '#5a5851' : '#aeaca2';
  const trimBlack = isNight ? '#0a0d12' : '#1a1d22';
  const glassDark = isNight ? '#0f1722' : '#2a3848';
  const glassFrame = isNight ? '#080a0e' : '#15181c';
  const door = isNight ? '#1c120a' : '#3e2818';
  const pavement = isNight ? '#2a2826' : '#5a5854';
  const lit = isNight ? '#fbcd6e' : '#000000';
  const litI = isNight ? 0.45 : 0;

  // Layout — main two-story block + side single-story wing.
  const W = 9.5;     // main block width (X)
  const D = 7.0;     // main block depth (Z)
  const H1 = 3.6;    // ground floor height
  const H2 = 3.4;    // upper floor height
  const cantilever = 1.8; // upper floor projects this far over entrance
  const wingW = 5.5;
  const wingD = 5.5;
  const wingH = 3.6;

  return (
    <group position={[0, 0, -22]} rotation={[0, 0, 0]}>
      {/* ENTRANCE PAVEMENT — asphalt-like pad in front */}
      <mesh position={[0, 0.02, D / 2 + 1.5]} receiveShadow>
        <boxGeometry args={[W + 1.5, 0.04, 3.0]} />
        <meshStandardMaterial color={pavement} roughness={0.95} />
      </mesh>

      {/* === GROUND FLOOR — concrete shell === */}
      {/* Back wall */}
      <mesh position={[0, H1 / 2, -D / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, H1, 0.2]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Left side wall */}
      <mesh position={[-W / 2, H1 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H1, D]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Right side wall */}
      <mesh position={[W / 2, H1 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H1, D]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Ground slab */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[W, 0.08, D]} />
        <meshStandardMaterial color={concreteDark} roughness={0.9} />
      </mesh>

      {/* Inner front wall behind glass (recessed entrance) */}
      <mesh position={[0, H1 / 2, -D / 4]} castShadow>
        <boxGeometry args={[W * 0.55, H1, 0.18]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>

      {/* === GROUND FLOOR FRONT GLASS WALLS === */}
      {/* Two large floor-to-ceiling glass panels flanking the entrance */}
      <GlassWall
        position={[-W * 0.27, H1 / 2, D / 2 + 0.02]}
        width={W * 0.42}
        height={H1 - 0.1}
        gridX={3}
        gridY={4}
        frameColor={glassFrame}
        glassColor={glassDark}
        emissive={lit}
        emissiveIntensity={litI}
      />
      <GlassWall
        position={[W * 0.27, H1 / 2, D / 2 + 0.02]}
        width={W * 0.42}
        height={H1 - 0.1}
        gridX={3}
        gridY={4}
        frameColor={glassFrame}
        glassColor={glassDark}
        emissive={lit}
        emissiveIntensity={litI}
      />

      {/* Front entrance double doors (recessed) */}
      <mesh position={[0, 1.1, D / 2 - 0.4]} castShadow>
        <boxGeometry args={[1.6, 2.2, 0.08]} />
        <meshStandardMaterial color={door} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Door split line */}
      <mesh position={[0, 1.1, D / 2 - 0.36]}>
        <boxGeometry args={[0.02, 2.1, 0.02]} />
        <meshStandardMaterial color={trimBlack} />
      </mesh>
      {/* Door handles */}
      {[-0.25, 0.25].map((x, i) => (
        <mesh key={`dh${i}`} position={[x, 1.1, D / 2 - 0.34]}>
          <boxGeometry args={[0.04, 0.4, 0.05]} />
          <meshStandardMaterial color="#c9a85a" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Floor slab between ground and upper (with cantilever overhang) */}
      <mesh
        position={[0, H1 + 0.08, cantilever / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[W + 0.2, 0.16, D + cantilever]} />
        <meshStandardMaterial color={concreteDark} roughness={0.85} />
      </mesh>

      {/* === UPPER FLOOR === */}
      {/* Upper floor back wall */}
      <mesh position={[0, H1 + 0.16 + H2 / 2, -D / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, H2, 0.2]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Upper left side — covers main block depth */}
      <mesh position={[-W / 2, H1 + 0.16 + H2 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H2, D]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Upper left cantilever side — closes the overhang zone */}
      <mesh position={[-W / 2, H1 + 0.16 + H2 / 2, D / 2 + cantilever / 2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H2, cantilever + 0.1]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Upper right side — covers main block depth */}
      <mesh position={[W / 2, H1 + 0.16 + H2 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H2, D]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Upper right cantilever side — closes the overhang zone */}
      <mesh position={[W / 2, H1 + 0.16 + H2 / 2, D / 2 + cantilever / 2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H2, cantilever + 0.1]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Upper inner front wall (above entrance, where balcony begins) */}
      <mesh position={[0, H1 + 0.16 + H2 / 2, -D / 4]} castShadow receiveShadow>
        <boxGeometry args={[W, H2, 0.18]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>

      {/* Upper floor front glass facade — single big panel */}
      <GlassWall
        position={[0, H1 + 0.16 + H2 / 2, D / 2 + cantilever - 0.05]}
        width={W - 0.4}
        height={H2 - 0.3}
        gridX={5}
        gridY={3}
        frameColor={glassFrame}
        glassColor={glassDark}
        emissive={lit}
        emissiveIntensity={litI}
      />

      {/* Roof slab — extends slightly beyond upper walls */}
      <mesh position={[0, H1 + 0.16 + H2 + 0.12, cantilever / 2]} castShadow>
        <boxGeometry args={[W + 0.4, 0.24, D + cantilever + 0.4]} />
        <meshStandardMaterial color={concreteDark} roughness={0.85} />
      </mesh>
      {/* Parapet on top of roof */}
      <mesh position={[0, H1 + 0.16 + H2 + 0.4, cantilever / 2]} castShadow>
        <boxGeometry args={[W + 0.4, 0.32, 0.12]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>

      {/* === UPPER BALCONY (over the entrance) === */}
      {/* Glass balcony railing on the cantilever edge */}
      <BalconyGlassRailing
        width={W - 0.4}
        baseY={H1 + 0.16 + 0.04}
        frontZ={D / 2 + cantilever - 0.05}
        frameColor={glassFrame}
      />

      {/* === SIDE WING (single story extending from -X side) === */}
      <group position={[-W / 2 - wingW / 2, 0, -D / 4]}>
        {/* Wing back/left/right/front walls */}
        <mesh position={[0, wingH / 2, -wingD / 2]} castShadow receiveShadow>
          <boxGeometry args={[wingW, wingH, 0.2]} />
          <meshStandardMaterial color={concrete} roughness={0.85} />
        </mesh>
        <mesh position={[-wingW / 2, wingH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, wingH, wingD]} />
          <meshStandardMaterial color={concrete} roughness={0.85} />
        </mesh>
        {/* Wing right wall — closes the junction side facing the main block */}
        <mesh position={[wingW / 2, wingH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, wingH, wingD]} />
          <meshStandardMaterial color={concrete} roughness={0.85} />
        </mesh>
        {/* Wing front: glass wall */}
        <GlassWall
          position={[0, wingH / 2, wingD / 2 - 0.05]}
          width={wingW - 0.4}
          height={wingH - 0.3}
          gridX={4}
          gridY={4}
          frameColor={glassFrame}
          glassColor={glassDark}
          emissive={lit}
          emissiveIntensity={litI}
        />
        {/* Wing roof slab */}
        <mesh position={[0, wingH + 0.12, 0]} castShadow>
          <boxGeometry args={[wingW + 0.4, 0.24, wingD + 0.4]} />
          <meshStandardMaterial color={concreteDark} roughness={0.85} />
        </mesh>
        {/* Wing parapet */}
        <mesh position={[0, wingH + 0.4, 0]} castShadow>
          <boxGeometry args={[wingW + 0.4, 0.32, 0.12]} />
          <meshStandardMaterial color={concrete} roughness={0.85} />
        </mesh>
      </group>

      {/* === SIDE WINDOWS on main block === */}
      <GlassWall
        position={[W / 2 + 0.02, H1 / 2, -D / 4]}
        width={D / 1.6}
        height={H1 - 0.6}
        gridX={3}
        gridY={3}
        rotationY={Math.PI / 2}
        frameColor={glassFrame}
        glassColor={glassDark}
        emissive={lit}
        emissiveIntensity={litI}
      />
      <GlassWall
        position={[W / 2 + 0.02, H1 + 0.16 + H2 / 2, -D / 4]}
        width={D / 1.6}
        height={H2 - 0.6}
        gridX={3}
        gridY={3}
        rotationY={Math.PI / 2}
        frameColor={glassFrame}
        glassColor={glassDark}
        emissive={lit}
        emissiveIntensity={litI}
      />

      {/* Warm porch light at night */}
      {isNight && (
        <pointLight
          position={[0, H1, D / 2 + 0.5]}
          color="#ffd49a"
          intensity={1.6}
          distance={9}
          decay={1.7}
        />
      )}
    </group>
  );
}

function GlassWall({
  position,
  width,
  height,
  gridX,
  gridY,
  rotationY = 0,
  frameColor,
  glassColor,
  emissive,
  emissiveIntensity,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  gridX: number;
  gridY: number;
  rotationY?: number;
  frameColor: string;
  glassColor: string;
  emissive: string;
  emissiveIntensity: number;
}) {
  const frameT = 0.04;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Outer frame */}
      <mesh>
        <boxGeometry args={[width, height, 0.04]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Glass panel — highly reflective so sun glints land on it */}
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[width - frameT * 2, height - frameT * 2]} />
        <meshStandardMaterial
          color={glassColor}
          metalness={0.9}
          roughness={0.04}
          envMapIntensity={1.4}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Vertical mullions */}
      {Array.from({ length: gridX - 1 }, (_, i) => {
        const x = -width / 2 + ((i + 1) / gridX) * width;
        return (
          <mesh key={`vm${i}`} position={[x, 0, 0.04]}>
            <boxGeometry args={[frameT * 0.6, height - frameT, 0.025]} />
            <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.4} />
          </mesh>
        );
      })}
      {/* Horizontal mullions */}
      {Array.from({ length: gridY - 1 }, (_, i) => {
        const y = -height / 2 + ((i + 1) / gridY) * height;
        return (
          <mesh key={`hm${i}`} position={[0, y, 0.04]}>
            <boxGeometry args={[width - frameT, frameT * 0.6, 0.025]} />
            <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function BalconyGlassRailing({
  width,
  baseY,
  frontZ,
  frameColor,
}: {
  width: number;
  baseY: number;
  frontZ: number;
  frameColor: string;
}) {
  const railH = 1.0;
  return (
    <group position={[0, baseY, frontZ]}>
      {/* Glass panel */}
      <mesh position={[0, railH / 2, 0]}>
        <boxGeometry args={[width, railH, 0.04]} />
        <meshStandardMaterial
          color="#7c8a99"
          transparent
          opacity={0.35}
          metalness={0.2}
          roughness={0.05}
        />
      </mesh>
      {/* Top metal cap */}
      <mesh position={[0, railH + 0.025, 0]}>
        <boxGeometry args={[width + 0.04, 0.05, 0.08]} />
        <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Bottom metal rail */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[width + 0.04, 0.04, 0.07]} />
        <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Fence({ isNight }: { isNight: boolean }) {
  const fenceHalfX = 25;
  const fenceHalfZ = 25;
  // Each side starts/ends at the EXACT corner; corner posts are shared.
  const segments: { from: [number, number]; to: [number, number] }[] = [
    { from: [-fenceHalfX, -fenceHalfZ], to: [fenceHalfX, -fenceHalfZ] },
    { from: [-fenceHalfX, fenceHalfZ], to: [fenceHalfX, fenceHalfZ] },
    { from: [-fenceHalfX, -fenceHalfZ], to: [-fenceHalfX, fenceHalfZ] },
    { from: [fenceHalfX, -fenceHalfZ], to: [fenceHalfX, fenceHalfZ] },
  ];
  return (
    <group>
      {segments.map((seg, i) => (
        <FenceSegment
          key={i}
          from={seg.from}
          to={seg.to}
          isNight={isNight}
        />
      ))}
      {/* Dedicated corner posts so they don't depend on segment endpoints */}
      {[
        [-fenceHalfX, -fenceHalfZ],
        [fenceHalfX, -fenceHalfZ],
        [-fenceHalfX, fenceHalfZ],
        [fenceHalfX, fenceHalfZ],
      ].map(([x, z], i) => (
        <mesh key={`cp${i}`} position={[x, 2.0, z]} castShadow>
          <boxGeometry args={[0.24, 4.0, 0.24]} />
          <meshStandardMaterial
            color={isNight ? '#161a20' : '#262c34'}
            roughness={0.55}
            metalness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

function FenceSegment({
  from,
  to,
  isNight,
}: {
  from: [number, number];
  to: [number, number];
  isNight: boolean;
}) {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;

  // Two-story fence: brick base + lower panel + mid trim + upper panel + cap
  const baseH = 0.6;
  const lowerH = 1.65;
  const midTrimH = 0.1;
  const upperH = 1.65;
  const totalH = baseH + lowerH + midTrimH + upperH;
  const wallT = 0.09;
  const postSize = 0.18;
  const postSpacing = 2.4;
  const numIntervals = Math.max(1, Math.round(length / postSpacing));

  const brickColor = isNight ? '#3a2218' : '#7a3c28';
  const panelLower = isNight ? '#3a2818' : '#6e482a';
  const panelUpper = isNight ? '#352519' : '#62421e';
  const trimColor = isNight ? '#1d1a18' : '#3a2818';
  const postColor = isNight ? '#161a20' : '#262c34';
  const capColor = isNight ? '#0f1217' : '#1a1f25';

  // Posts skip the very corners (those are rendered separately by Fence)
  const inset = postSize * 0.5;
  const usableLen = length - inset * 2;
  const postPositions: number[] = [];
  for (let i = 0; i <= numIntervals; i++) {
    postPositions.push(-usableLen / 2 + (i / numIntervals) * usableLen);
  }
  const segLen = usableLen / numIntervals;

  return (
    <group position={[cx, 0, cz]} rotation={[0, -angle, 0]}>
      {/* Brick base — continuous solid wall (full length to corner) */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, baseH, wallT * 1.1]} />
        <meshStandardMaterial color={brickColor} roughness={0.95} />
      </mesh>

      {/* Lower row wood-look panels */}
      {Array.from({ length: numIntervals }, (_, i) => {
        const x = -usableLen / 2 + segLen * (i + 0.5);
        return (
          <mesh
            key={`pl${i}`}
            position={[x, baseH + lowerH / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[segLen - postSize, lowerH, wallT]} />
            <meshStandardMaterial color={panelLower} roughness={0.85} />
          </mesh>
        );
      })}

      {/* Mid horizontal trim band running full length */}
      <mesh position={[0, baseH + lowerH + midTrimH / 2, 0]} castShadow>
        <boxGeometry args={[length, midTrimH, wallT * 1.15]} />
        <meshStandardMaterial color={trimColor} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Upper row panels (slightly different tone) */}
      {Array.from({ length: numIntervals }, (_, i) => {
        const x = -usableLen / 2 + segLen * (i + 0.5);
        return (
          <mesh
            key={`pu${i}`}
            position={[x, baseH + lowerH + midTrimH + upperH / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[segLen - postSize, upperH, wallT]} />
            <meshStandardMaterial color={panelUpper} roughness={0.85} />
          </mesh>
        );
      })}

      {/* Anthracite vertical posts (inner only — corner posts handled by Fence) */}
      {postPositions.slice(1, -1).map((u, i) => (
        <mesh key={`pst${i}`} position={[u, totalH / 2, 0]} castShadow>
          <boxGeometry args={[postSize, totalH + 0.05, postSize]} />
          <meshStandardMaterial color={postColor} roughness={0.55} metalness={0.25} />
        </mesh>
      ))}

      {/* Top cap */}
      <mesh position={[0, totalH + 0.05, 0]} castShadow>
        <boxGeometry args={[length, 0.1, wallT * 1.4]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
    </group>
  );
}

function OuterCladding({
  halfW,
  halfL,
  config,
  claddingTex,
}: {
  halfW: number;
  halfL: number;
  config: PoolConfig;
  claddingTex: THREE.Texture | null;
}) {
  if (!claddingTex) return null;
  const h = PANEL_H;
  const yMid = BASIN_FLOOR + PANEL_H / 2;
  const innerW = halfW * 2 - FRAME_T * 2;
  const innerL = halfL * 2 - FRAME_T * 2;
  const segGap = 0.02;
  const sides: { name: PoolSide; axis: 'x' | 'z'; wallCoord: number; spanInner: number }[] = [
    { name: 'south', axis: 'x', wallCoord:  halfL, spanInner: innerW },
    { name: 'north', axis: 'x', wallCoord: -halfL, spanInner: innerW },
    { name: 'east',  axis: 'z', wallCoord:  halfW, spanInner: innerL },
    { name: 'west',  axis: 'z', wallCoord: -halfW, spanInner: innerL },
  ];
  return (
    <group>
      {sides.flatMap((side) => {
        const bounds = panelBounds(side.name, config, side.spanInner);
        return bounds.map((bd, i) => {
          if (getPanelType(config, side.name, i) === 'glass') return null;
          const center = (bd.start + bd.end) / 2;
          const pLen = bd.end - bd.start - segGap;
          const sign = side.wallCoord > 0 ? 1 : -1;
          const offset = sign * 0.002;
          const position: [number, number, number] = side.axis === 'x'
            ? [center, yMid, side.wallCoord + offset]
            : [side.wallCoord + offset, yMid, center];
          const rotY = side.axis === 'x'
            ? (side.wallCoord > 0 ? 0 : Math.PI)
            : (side.wallCoord > 0 ? Math.PI / 2 : -Math.PI / 2);
          return (
            <mesh key={`oc-${side.name}-${i}`} position={position} rotation={[0, rotY, 0]} castShadow receiveShadow>
              <planeGeometry args={[pLen, h]} />
              <meshStandardMaterial color="#ffffff" map={claddingTex} roughness={0.75} metalness={0.02} />
            </mesh>
          );
        });
      })}
    </group>
  );
}

/**
 * Seçilen zeminin havuz çevresinde gösterimi:
 * - 'auto':   bahçe — çim zaten bahçenin kendisi; diğer zeminler bordürlü döşeme
 * - 'kerb':   fotoğraf (Mekânda Gör) — her zemin bordürlü döşeme olarak
 * - 'plinth': stüdyo — her zemin koyu kenarlı kaide olarak
 */
export type GroundPatchStyle = 'auto' | 'kerb' | 'plinth';

export function Pool({
  config,
  isNight,
  groundPatch = 'auto',
}: {
  config: PoolConfig;
  isNight: boolean;
  groundPatch?: GroundPatchStyle;
}) {
  const w = config.width;
  const l = config.length;
  const halfW = w / 2;
  const halfL = l / 2;

  const top = POOL_HEIGHT;
  const waterY = top - COPING_T - 0.12;

  const frame = frameColorHex(config.frameColor);
  const inner = claddingColor(config.cladding);
  const claddingTex = useCladdingTexture(config.cladding);
  const sink = sinkDepth(config);
  const hole = sink > 0 ? poolFootprint(config) : null;
  // Güverte aşağıdayken havuz ağzının üstündeki şelale sökülmüş sayılır
  const deckDown = config.liftDeck && config.liftDeckUp === false;
  // Tam gömülüde güverte zemin hizasındadır; dış merdiven olmaz (Platform ile aynı kural)
  const hasStairs = config.stairStyle !== 'none' && top - sink > 0.2;
  const ext = extensionLayout(config, hasStairs);
  const showRailings = config.railings && config.installation !== 'sunken';
  // Kapak bölmesi makine dairesinin karşı kenarında (hareketli güverteyle birlikte olamaz)
  const OPPOSITE: Record<PoolSide, PoolSide> = { north: 'south', south: 'north', east: 'west', west: 'east' };
  const coverBay = config.poolCover && !config.liftDeck
    ? { side: OPPOSITE[config.platformDirection], depth: COVER_BAY_DEPTH }
    : null;
  const outdoor = outdoorLightingOf(config);
  // Platformun, köşe parçasıyla birleşen uçları (korkuluk konmaz)
  const dir = config.platformDirection;
  const alongEW = dir === 'east' || dir === 'west';
  const platformOpenEnds = {
    neg: ext.corners.some((c) => (alongEW ? c.ew === dir && c.ns === 'north' : c.ns === dir && c.ew === 'west')),
    pos: ext.corners.some((c) => (alongEW ? c.ew === dir && c.ns === 'south' : c.ns === dir && c.ew === 'east')),
  };

  return (
    <group>
      {/* Deck platform — çimen seçiliyken gizle, diğer zemin tiplerinde göster */}
      {(config.ground !== 'grass' || groundPatch !== 'auto') && (
        <PoolDeck footprint={layoutFootprint(config)} ground={config.ground} isNight={isNight} hole={hole} soft={groundPatch === 'plinth'} margin={groundPatch === 'kerb' ? 1.2 : 2.5} />
      )}

      {/* Kazı çukurunun toprak duvarları — yalnızca içeriden (camın arkasından) görünür */}
      {hole && (
        <mesh position={[(hole.minX + hole.maxX) / 2, -sink / 2, (hole.minZ + hole.maxZ) / 2]}>
          <boxGeometry args={[hole.maxX - hole.minX + 0.04, sink, hole.maxZ - hole.minZ + 0.04]} />
          <meshStandardMaterial color={isNight ? '#2a2119' : '#5a4632'} roughness={1} side={THREE.BackSide} />
        </mesh>
      )}

      {/* Havuz gövdesi — gömülü kurulumda zemin altına iner */}
      <group position={[0, -sink, 0]}>

      {/* Bottom slab (closed pool floor) */}
      <mesh position={[0, BASIN_FLOOR / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, BASIN_FLOOR, l]} />
        <meshStandardMaterial color={frame} />
      </mesh>

      {/* Inner cladding floor (sits just above slab) */}
      <mesh
        position={[0, BASIN_FLOOR + 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[w - LINER * 2 + 0.01, l - LINER * 2 + 0.01]} />
        <CladdingMat
          tex={claddingTex}
          color={inner}
          sw={w - LINER * 2}
          sh={l - LINER * 2}
          surface="floor"
          roughness={0.85}
          metalness={0}
          envMapIntensity={0}
        />
      </mesh>

      {/* Animated caustics overlay on the pool floor — only when water is present */}
      {config.showWater && (
        <PoolCaustics
          w={w}
          l={l}
          floorY={BASIN_FLOOR + 0.012}
          lightEnabled={config.lighting.enabled}
          lightColor={config.lighting.color}
        />
      )}


      {/* Water volume — the body of water inside the pool, visible through glass */}
      {config.showWater && <WaterVolume w={w} l={l} waterY={waterY} />}

      {/* İç astar: çerçevenin önünde, kapalı panellerde tam kaplama, camda çerçeve şeritleri */}
      <InnerLiner halfW={halfW} halfL={halfL} top={top} config={config} color={inner} claddingTex={claddingTex} />

      {/* Inner wall cladding strip visible above the waterline */}
      <InnerRim w={w} l={l} waterY={waterY} top={top} color={inner} claddingTex={claddingTex} />

      {/* Side panels — one mesh per (side, segment) so each can be glass/closed */}
      <SidePanels
        halfW={halfW}
        halfL={halfL}
        top={top}
        config={config}
        frame={frame}
      />

      {/* OuterCladding removed — cladding is interior floor only */}

      {/* Vertical mullions dividing each side into segments */}
      <Mullions
        halfW={halfW}
        halfL={halfL}
        top={top}
        color={frame}
        config={config}
      />

      {/* 4 corner posts */}
      <CornerPosts halfW={halfW} halfL={halfL} top={top} color={frame} />

      {/* Bottom + top frame beams */}
      <FrameBeams w={w} l={l} halfW={halfW} halfL={halfL} top={top} color={frame} />

      {/* Wood coping */}
      <Coping w={w} l={l} y={top} skip={coverBay?.side} />

      {/* Water top surface — custom GLSL shader: animated waves + sun glints +
          shimmer + fresnel rim. Lights up at night when pool lighting is on. */}
      {config.showWater && (
        <CinematicWater
          w={w}
          l={l}
          waterY={waterY}
          lightEnabled={config.lighting.enabled}
          lightColor={config.lighting.color}
        />
      )}

      {/* İç aydınlatma: her kapalı kenarın ortasında bir yuvarlak lamba (beyaz ya da RGB) */}
      {config.lighting.enabled && (
        <PoolSideLamps
          color={config.lighting.color}
          w={w}
          l={l}
          waterY={waterY}
          isNight={isNight}
          config={config}
        />
      )}

      {/* Stainless steel waterfall feature (optional) */}
      {config.waterfall && !config.liftDeck && <Waterfall halfL={halfL} top={top} />}

      {/* Hareketli güverte: köşe kolonlarında yukarı/aşağı (daima antrasit) */}
      {config.liftDeck && (
        <LiftDeck w={w} l={l} top={top} groundY={sink} frame={MACHINE_ROOM_COLOR} up={!deckDown} isNight={isNight} solar={config.liftDeckSolar} direction={config.platformDirection} />
      )}

      {/* Automatic slatted roller cover (optional) — slides closed when enabled */}
      {config.poolCover && !config.liftDeck && (
        <PoolCover
          w={w}
          l={l}
          top={top}
          waterY={waterY}
          frame={frame}
          direction={config.platformDirection}
          closed={config.poolCoverClosed}
          innerColor={inner}
          claddingTex={claddingTex}
          landingSide={poolEntryOf(config) !== 'none' ? stepsWallSide(w, l) : undefined}
        />
      )}

      {/* Havuza giriş: havuz içi basamaklar */}
      {poolEntryOf(config) !== 'none' && (
        <PoolSteps
          entry={poolEntryOf(config)}
          halfW={halfW}
          halfL={halfL}
          platformDirection={config.platformDirection}
          color={inner}
          claddingTex={claddingTex}
          reserve={coverBay}
        />
      )}

      {/* Side platform + stairs + railings */}
      <Platform
        halfW={halfW}
        halfL={halfL}
        top={top}
        direction={config.platformDirection}
        frameColor={frame}
        showStairs={config.stairStyle !== 'none'}
        showRailings={showRailings}
        extended={config.platformExtension}
        groundY={sink}
        blockStairs={config.stairStyle === 'block'}
        openEnds={platformOpenEnds}
      />

      {/* Dış aydınlatma (opsiyonel) */}
      {outdoor.strip && top - sink > 0.25 && (
        <OuterStripLed runs={stripLedRuns(config, ext.decks, ext.corners)} top={top} groundY={sink} isNight={isNight} />
      )}

      {/* Kenar terasları + köşe parçaları (dekorlu) */}
      {(ext.decks.length > 0 || ext.corners.length > 0) && (
        <ExtensionDecks
          decks={ext.decks}
          corners={ext.corners}
          top={top}
          frameColor={frame}
          railings={showRailings}
        />
      )}
      </group>
    </group>
  );
}

/**
 * Havuzun iç kaplama astarı (duvar dış yüzünden LINER kadar içeride): kapalı panellerde tabandan
 * kenar altına tam yüzey; cam panellerde camı çevreleyen alt ve yan kaplama şeritleri. Üst kiriş
 * kenar bandıyla (InnerRim) örtülür. Böylece çerçeve kirişleri, dikmeler ve köşe kolonları içeriden görünmez.
 */
function InnerLiner({
  halfW,
  halfL,
  top,
  config,
  color,
  claddingTex,
}: {
  halfW: number;
  halfL: number;
  top: number;
  config: PoolConfig;
  color: string;
  claddingTex: THREE.Texture | null;
}) {
  const yBot = BASIN_FLOOR;
  const yTop = top - COPING_T;
  const H = yTop - yBot;
  const BOTTOM = 0.19; // alt kiriş + taban birleşimi
  const SIDE = 0.05;   // dikme / köşe kolonu payı
  const sides: { name: PoolSide; alongX: boolean; coord: number; rotY: number }[] = [
    { name: 'south', alongX: true, coord: halfL - LINER, rotY: Math.PI },
    { name: 'north', alongX: true, coord: -halfL + LINER, rotY: 0 },
    { name: 'east', alongX: false, coord: halfW - LINER, rotY: -Math.PI / 2 },
    { name: 'west', alongX: false, coord: -halfW + LINER, rotY: Math.PI / 2 },
  ];
  const quads: {
    key: string; pos: [number, number, number]; rotY: number; w: number; h: number;
    full: boolean; corners: [boolean, boolean];
  }[] = [];
  for (const sd of sides) {
    const half = (sd.alongX ? halfW : halfL) - LINER;
    const bounds = panelBounds(sd.name, config, (sd.alongX ? halfW : halfL) * 2 - FRAME_T);
    const at = (c: number, y: number): [number, number, number] => (sd.alongX ? [c, y, sd.coord] : [sd.coord, y, c]);
    bounds.forEach((bd, i) => {
      const a = i === 0 ? -half : Math.max(bd.start, -half);
      const b = i === bounds.length - 1 ? half : Math.min(bd.end, half);
      if (b - a < 0.01) return;
      // Düzlemin u=0 ucu dünyada c0'da mı c1'de mi (güney ve batı düzlemleri ters döner)
      const flip = sd.name === 'south' || sd.name === 'west';
      const lowCorner = i === 0;
      const highCorner = i === bounds.length - 1;
      const corners: [boolean, boolean] = flip ? [highCorner, lowCorner] : [lowCorner, highCorner];
      const add = (k: string, c0: number, c1: number, y0: number, y1: number, full = false) =>
        quads.push({
          key: `${sd.name}-${i}-${k}`, pos: at((c0 + c1) / 2, (y0 + y1) / 2), rotY: sd.rotY,
          w: c1 - c0, h: y1 - y0, full, corners,
        });
      if (getPanelType(config, sd.name, i) !== 'glass') {
        add('f', a, b, yBot, yTop, true);
      } else {
        add('b', a, b, yBot, yBot + BOTTOM);
        add('l', a, Math.min(b, a + SIDE), yBot + BOTTOM, yTop);
        add('r', Math.max(a, b - SIDE), b, yBot + BOTTOM, yTop);
      }
    });
  }
  return (
    <group>
      {quads.map((q) => (
        <mesh key={q.key} position={q.pos} rotation={[0, q.rotY, 0]} renderOrder={3}>
          <planeGeometry args={[q.w, q.h]} />
          <CladdingMat tex={claddingTex} color={color} sw={q.w} sh={q.h} roughness={0.8} metalness={0.01} side={THREE.DoubleSide} surface={q.full ? 'wall' : 'wallTone'} corners={q.corners} />
        </mesh>
      ))}
    </group>
  );
}

function CornerPosts({
  halfW,
  halfL,
  top,
  color,
}: {
  halfW: number;
  halfL: number;
  top: number;
  color: string;
}) {
  const corners: [number, number][] = [
    [halfW, halfL],
    [-halfW, halfL],
    [halfW, -halfL],
    [-halfW, -halfL],
  ];
  const postH = top - COPING_T;
  return (
    <group>
      {corners.map(([x, z], i) => (
        <Beam args={[FRAME_T, postH, FRAME_T]} key={i} position={[x, postH / 2, z]} castShadow>
          <PowderCoatMaterial color={color} />
        </Beam>
      ))}
    </group>
  );
}

function Mullions({
  halfW,
  halfL,
  top,
  color,
  config,
}: {
  halfW: number;
  halfL: number;
  top: number;
  color: string;
  config: PoolConfig;
}) {
  const panelHeight = top - COPING_T - BASIN_FLOOR;
  const yMid = BASIN_FLOOR + panelHeight / 2;
  const mullionT = 0.07;
  const mullionD = 0.09; // depth into the wall (slightly more than panel)
  const innerW = halfW * 2 - FRAME_T;
  const innerL = halfL * 2 - FRAME_T;
  // Panel sınırları (standart 2,40 m camlar + kesik cam); kuzey/güney X boyunca, doğu/batı Z boyunca
  const boundsX = panelBounds('south', config, innerW);
  const boundsZ = panelBounds('east', config, innerL);

  // Dikmeler her panel birleşiminde (cam ya da kapalı): kapalı panellerin arasından iç kaplama görünmez
  const offsetsX = boundsX.slice(0, -1).map((b) => b.end);
  const offsetsZ = boundsZ.slice(0, -1).map((b) => b.end);

  return (
    <group>
      {/* Mullions on +Z (south) and -Z (north) walls */}
      {offsetsX.map((x, i) => (
        <group key={`x${i}`}>
          <Beam args={[mullionT, panelHeight, mullionD]} position={[x, yMid, halfL - mullionD / 2]} castShadow>
            <PowderCoatMaterial color={color} />
          </Beam>
          <Beam args={[mullionT, panelHeight, mullionD]} position={[x, yMid, -halfL + mullionD / 2]} castShadow>
            <PowderCoatMaterial color={color} />
          </Beam>
        </group>
      ))}
      {/* Mullions on +X (east) and -X (west) walls */}
      {offsetsZ.map((z, i) => (
        <group key={`z${i}`}>
          <Beam args={[mullionD, panelHeight, mullionT]} position={[halfW - mullionD / 2, yMid, z]} castShadow>
            <PowderCoatMaterial color={color} />
          </Beam>
          <Beam args={[mullionD, panelHeight, mullionT]} position={[-halfW + mullionD / 2, yMid, z]} castShadow>
            <PowderCoatMaterial color={color} />
          </Beam>
        </group>
      ))}
    </group>
  );
}

function SidePanels({
  halfW,
  halfL,
  top,
  config,
  frame,
}: {
  halfW: number;
  halfL: number;
  top: number;
  config: PoolConfig;
  frame: string;
}) {
  const panelHeight = top - COPING_T - BASIN_FLOOR;
  const yMid = BASIN_FLOOR + panelHeight / 2;
  const innerW = halfW * 2 - FRAME_T;
  const innerL = halfL * 2 - FRAME_T;
  const segGap = 0.02;

  // axis === 'x' → wall spans X (north/south); axis === 'z' → wall spans Z (east/west)
  const sides: {
    name: PoolSide;
    axis: 'x' | 'z';
    wallCoord: number;
    spanInner: number;
    panelDepth: number;
  }[] = [
    { name: 'south', axis: 'x', wallCoord:  halfL - PANEL_T / 2, spanInner: innerW, panelDepth: PANEL_T },
    { name: 'north', axis: 'x', wallCoord: -halfL + PANEL_T / 2, spanInner: innerW, panelDepth: PANEL_T },
    { name: 'east',  axis: 'z', wallCoord:  halfW - PANEL_T / 2, spanInner: innerL, panelDepth: PANEL_T },
    { name: 'west',  axis: 'z', wallCoord: -halfW + PANEL_T / 2, spanInner: innerL, panelDepth: PANEL_T },
  ];

  return (
    <group>
      {sides.flatMap((side) => {
        const bounds = panelBounds(side.name, config, side.spanInner);
        const segments = bounds.length;

        return bounds.map((bd, i) => {
          const type = getPanelType(config, side.name, i);
          const isGlass = type === 'glass';

          const isFirst = i === 0;
          const isLast  = i === segments - 1;
          const leftGap  = isFirst ? 0 : segGap / 2;
          const rightGap = isLast  ? 0 : segGap / 2;
          const sizeAlong = bd.end - bd.start - leftGap - rightGap;
          const center = (bd.start + bd.end) / 2 + (leftGap - rightGap) / 2;
          const args: [number, number, number] =
            side.axis === 'x'
              ? [sizeAlong, panelHeight, side.panelDepth]
              : [side.panelDepth, panelHeight, sizeAlong];

          const position: [number, number, number] =
            side.axis === 'x'
              ? [center, yMid, side.wallCoord]
              : [side.wallCoord, yMid, center];


          return (
            <group key={`${side.name}-${i}`}>
              {/* Panel box */}
              <Beam args={args} radius={0.004} position={position} castShadow receiveShadow renderOrder={2}>
                {isGlass ? <GlassMaterial /> : <PowderCoatMaterial color={frame} roughness={0.7} metalness={0.1} />}
              </Beam>

            </group>
          );
        });
      })}
    </group>
  );
}

function InnerRim({
  w,
  l,
  waterY,
  top,
  color,
  claddingTex = null,
}: {
  w: number;
  l: number;
  waterY: number;
  top: number;
  color: string;
  claddingTex?: THREE.Texture | null;
}) {
  // Thin cladding band visible above the water line, all around the pool perimeter.
  const rimHeight = top - waterY;
  if (rimHeight <= 0) return null;
  const yMid = waterY + rimHeight / 2;
  const inset = LINER + 0.004; // astarın hemen önünde (z-fighting olmasın)
  const halfW = w / 2 - inset;
  const halfL = l / 2 - inset;
  return (
    <group>
      <mesh position={[0, yMid, halfL]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={w - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} surface="wallTone" />
      </mesh>
      <mesh position={[0, yMid, -halfL]}>
        <planeGeometry args={[w - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={w - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} surface="wallTone" />
      </mesh>
      <mesh position={[halfW, yMid, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[l - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={l - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} surface="wallTone" />
      </mesh>
      <mesh position={[-halfW, yMid, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[l - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={l - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} surface="wallTone" />
      </mesh>
    </group>
  );
}

function WaterVolume({
  w,
  l,
  waterY,
}: {
  w: number;
  l: number;
  waterY: number;
}) {
  const inset = PANEL_T + 0.025;
  const bottomY = BASIN_FLOOR + 0.01;
  const height = waterY - bottomY;
  const yMid = bottomY + height / 2;
  return (
    <group>
      {/* Volume of water — tinted but clear, so the cladding stays visible */}
      <mesh position={[0, yMid, 0]} renderOrder={1}>
        <boxGeometry args={[w - inset * 2, height, l - inset * 2]} />
        <meshStandardMaterial
          color="#2f9fcc"
          transparent
          opacity={0.3}
          roughness={0.3}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Realistic gentle water shader. Sums four traveling waves at different
// directions/frequencies/speeds plus high-frequency micro-ripples for
// organic-looking pool water. The fragment shader uses the wave height
// to brighten peaks slightly (foam-ish) and applies sun glint + fresnel.
const WATER_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vWaveHeight;

  uniform float uTime;
  uniform float uAmp;

  // Returns vec3(height, d/dx, d/dy) for a single traveling sine wave.
  vec3 traveling(vec2 dir, float freq, float speed, float amp, vec2 p, float t) {
    float phase = dot(dir, p) * freq + t * speed;
    float h = sin(phase) * amp;
    float dh = cos(phase) * amp * freq;
    return vec3(h, dh * dir.x, dh * dir.y);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Four big waves traveling in different directions
    vec3 w1 = traveling(normalize(vec2( 1.0,  0.3)),  6.0, 0.9, uAmp,        pos.xy, uTime);
    vec3 w2 = traveling(normalize(vec2(-0.5,  1.0)),  5.0, 1.1, uAmp * 0.85, pos.xy, uTime);
    vec3 w3 = traveling(normalize(vec2( 0.7, -0.8)),  9.0, 1.4, uAmp * 0.55, pos.xy, uTime);
    vec3 w4 = traveling(normalize(vec2(-0.9, -0.4)), 14.0, 1.7, uAmp * 0.3,  pos.xy, uTime);
    // High-frequency micro-ripples on top (very small amplitude)
    vec3 r1 = traveling(normalize(vec2( 0.6,  0.8)), 28.0, 2.4, uAmp * 0.18, pos.xy, uTime);
    vec3 r2 = traveling(normalize(vec2(-0.7,  0.7)), 34.0, 2.8, uAmp * 0.14, pos.xy, uTime);

    float h  = w1.x + w2.x + w3.x + w4.x + r1.x + r2.x;
    float dx = w1.y + w2.y + w3.y + w4.y + r1.y + r2.y;
    float dy = w1.z + w2.z + w3.z + w4.z + r1.z + r2.z;

    pos.z += h;
    vWaveHeight = h;

    vec3 localN = normalize(vec3(-dx, -dy, 1.0));
    vWorldNormal = normalize((modelMatrix * vec4(localN, 0.0)).xyz);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vWaveHeight;

  uniform float uTime;
  uniform float uAmp;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uEmissive;
  uniform float uEmissiveStrength;
  uniform float uOpacity;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;

  void main() {
    // Edge-to-center color depth (shallow at edges, deeper toward middle)
    vec2 toEdge = abs(vUv - 0.5);
    float edgeFactor = max(toEdge.x, toEdge.y);
    vec3 base = mix(uDeepColor, uShallowColor, smoothstep(0.0, 0.5, edgeFactor));

    // Subtle sparkle from animated noise
    vec2 nUv = vUv * 80.0;
    float n1 = sin(nUv.x + uTime * 0.6) * sin(nUv.y * 0.9 - uTime * 0.5);
    float sparkle = pow(max(n1, 0.0), 10.0) * 0.35;

    // Sun glint (sharp Blinn-Phong specular)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfway = normalize(uSunDirection + viewDir);
    float spec = pow(max(dot(vWorldNormal, halfway), 0.0), 120.0) * 1.6;

    // Fresnel rim — brighter at grazing angles
    float fresnel = pow(1.0 - max(dot(vWorldNormal, viewDir), 0.0), 3.5);

    // Sky/environment reflection along the reflected view ray (cheap IBL approx).
    // Reflected ray pointing up sees the zenith colour, near-horizontal sees the
    // paler horizon — gives the surface a believable mirrored sky.
    vec3 reflDir = reflect(-viewDir, vWorldNormal);
    float skyT = clamp(reflDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 skyRefl = mix(uHorizonColor, uSkyColor, skyT);

    // Tiny foam tint at the very top of wave peaks
    float peakNorm = clamp(vWaveHeight / max(uAmp, 0.0001), 0.0, 3.0);
    float foam = pow(peakNorm, 3.0) * 0.06;

    vec3 col = base
      + uSunColor * spec
      + uSunColor * sparkle
      + skyRefl * fresnel * 0.55
      + vec3(0.95, 0.98, 1.0) * foam
      + uEmissive * uEmissiveStrength;

    // Gerçek su: dik bakınca dip görünür, yatık açıda gökyüzü yansıması baskınlaşır
    float alpha = clamp(uOpacity * (0.32 + 0.6 * fresnel) + spec + sparkle + uEmissiveStrength * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function CinematicWater({
  w,
  l,
  waterY,
  lightEnabled,
  lightColor,
}: {
  w: number;
  l: number;
  waterY: number;
  lightEnabled: boolean;
  lightColor: LightColor;
}) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.009 }, // gentle waves (was 0.018)
      uDeepColor: { value: new THREE.Color('#0a4d6e') },
      uShallowColor: { value: new THREE.Color('#5fb6dc') },
      uSunDirection: {
        value: new THREE.Vector3(0.5, 0.6, 0.6).normalize(),
      },
      uSunColor: { value: new THREE.Color('#fff5dc') },
      uEmissive: { value: new THREE.Color('#000000') },
      uEmissiveStrength: { value: 0 },
      uOpacity: { value: 1 },
      uSkyColor: { value: new THREE.Color('#5a9bd4') },
      uHorizonColor: { value: new THREE.Color('#d6ebf7') },
    }),
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    if (lightEnabled) {
      uniforms.uEmissiveStrength.value = 0.4;
      uniforms.uEmissive.value.copy(
        animatedColor(lightColor, state.clock.elapsedTime)
      );
      // Night sky reflection — dark blue
      uniforms.uSkyColor.value.set('#10182e');
      uniforms.uHorizonColor.value.set('#1d2748');
    } else {
      uniforms.uEmissiveStrength.value = 0;
      uniforms.uEmissive.value.set(0, 0, 0);
      // Day sky reflection
      uniforms.uSkyColor.value.set('#5a9bd4');
      uniforms.uHorizonColor.value.set('#d6ebf7');
    }
    // Frame pacing handled by <AnimationTicker> (≈30fps) — no per-frame invalidate here
  });

  return (
    <mesh
      position={[0, waterY + 0.005, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      {/* High subdivision so wave displacement is smooth */}
      <planeGeometry
        args={[w - PANEL_T * 2 - 0.05, l - PANEL_T * 2 - 0.05, 64, 96]}
      />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={WATER_VERT}
        fragmentShader={WATER_FRAG}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// Animated caustics on the pool floor — sums sine waves at four different
// angles to make rippling bright bands. Cheap and fully procedural.
const CAUSTICS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CAUSTICS_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;

  void main() {
    float c = 0.0;
    for (int i = 0; i < 4; i++) {
      float angle = float(i) * 0.785;
      vec2 dir = vec2(cos(angle), sin(angle));
      c += sin(dot(vUv * 9.0, dir) + uTime * (1.0 + float(i) * 0.15) + float(i) * 1.7);
    }
    c /= 4.0;
    c = 1.0 - abs(c);
    c = pow(c, 6.0);

    // Second layer offset and slower for variation
    float c2 = 0.0;
    for (int i = 0; i < 4; i++) {
      float angle = float(i) * 0.785 + 0.3;
      vec2 dir = vec2(cos(angle), sin(angle));
      c2 += sin(dot((vUv + 0.4) * 7.0, dir) + uTime * (0.7 + float(i) * 0.1));
    }
    c2 /= 4.0;
    c2 = pow(1.0 - abs(c2), 7.0);

    float pattern = max(c, c2 * 0.7);
    vec3 col = uColor * pattern * uIntensity;
    gl_FragColor = vec4(col, pattern * 0.6);
  }
`;

function PoolCaustics({
  w,
  l,
  floorY,
  lightEnabled,
  lightColor,
}: {
  w: number;
  l: number;
  floorY: number;
  lightEnabled: boolean;
  lightColor: LightColor;
}) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#cfeefc') },
      uIntensity: { value: 0.7 },
    }),
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    if (lightEnabled) {
      uniforms.uColor.value.copy(
        animatedColor(lightColor, state.clock.elapsedTime)
      );
      uniforms.uIntensity.value = 1.1;
    } else {
      uniforms.uColor.value.set('#cfeefc');
      uniforms.uIntensity.value = 0.7;
    }
    // keep caustics animating under demand rendering
  });

  return (
    <mesh
      position={[0, floorY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[w - PANEL_T * 2 - 0.04, l - PANEL_T * 2 - 0.04]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={CAUSTICS_VERT}
        fragmentShader={CAUSTICS_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FrameBeams({
  w,
  l,
  halfW,
  halfL,
  top,
  color,
}: {
  w: number;
  l: number;
  halfW: number;
  halfL: number;
  top: number;
  color: string;
}) {
  // Top horizontal beams (just under coping)
  const beamY = top - COPING_T / 2 - 0.05;
  const beamH = 0.06;
  return (
    <group>
      {/* Top beams */}
      <Beam args={[w, beamH, FRAME_T * 0.7]} position={[0, beamY, halfL - FRAME_T / 2]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      <Beam args={[w, beamH, FRAME_T * 0.7]} position={[0, beamY, -halfL + FRAME_T / 2]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      <Beam args={[FRAME_T * 0.7, beamH, l]} position={[halfW - FRAME_T / 2, beamY, 0]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      <Beam args={[FRAME_T * 0.7, beamH, l]} position={[-halfW + FRAME_T / 2, beamY, 0]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      {/* Bottom skirt beams */}
      <Beam args={[w, 0.1, FRAME_T * 0.7]} position={[0, BASIN_FLOOR + 0.05, halfL - FRAME_T / 2]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      <Beam args={[w, 0.1, FRAME_T * 0.7]} position={[0, BASIN_FLOOR + 0.05, -halfL + FRAME_T / 2]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      <Beam args={[FRAME_T * 0.7, 0.1, l]} position={[halfW - FRAME_T / 2, BASIN_FLOOR + 0.05, 0]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
      <Beam args={[FRAME_T * 0.7, 0.1, l]} position={[-halfW + FRAME_T / 2, BASIN_FLOOR + 0.05, 0]} castShadow>
        <PowderCoatMaterial color={color} />
      </Beam>
    </group>
  );
}

function Coping({ w, l, y, skip }: { w: number; l: number; y: number; skip?: PoolSide }) {
  const halfW = w / 2;
  const halfL = l / 2;
  const out = COPING_W - FRAME_T;
  const totalW = w + out * 2;
  // Long beams (+Z/-Z) cover the corners. Short beams (+X/-X) are trimmed to
  // fit between them so corners don't overlap and z-fight.
  const insetPerSide = (COPING_W - out) / 2;
  const xBeamLength = l - 2 * insetPerSide;
  return (
    <group position={[0, y - COPING_T / 2, 0]}>
      {/* +Z (south) beam — full width including corner overhang */}
      {skip !== 'south' && <Beam args={[totalW, COPING_T, COPING_W]} radius={0.012} position={[0, 0, halfL + out / 2]} castShadow receiveShadow>
        <DeckSurfaceMaterial />
      </Beam>}
      {/* -Z (north) beam */}
      {skip !== 'north' && <Beam args={[totalW, COPING_T, COPING_W]} radius={0.012} position={[0, 0, -halfL - out / 2]} castShadow receiveShadow>
        <DeckSurfaceMaterial />
      </Beam>}
      {/* +X (east) beam — trimmed to fit between +Z and -Z beams */}
      {skip !== 'east' && <Beam args={[xBeamLength, COPING_T, COPING_W]} radius={0.012} position={[halfW + out / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <DeckSurfaceMaterial />
      </Beam>}
      {/* -X (west) beam */}
      {skip !== 'west' && <Beam args={[xBeamLength, COPING_T, COPING_W]} radius={0.012} position={[-halfW - out / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <DeckSurfaceMaterial />
      </Beam>}
    </group>
  );
}

/**
 * Güneş paneli dizisi: standart 1,13 × 1,72 m paneller, aralarında 2 cm boşluk, alana ortalanmış ızgara.
 * Panelin uzun kenarı alanın uzun kenarına paralel dizilir.
 */
function SolarArray({ width, depth, y }: { width: number; depth: number; y: number }) {
  const tex = useMemo(getSolarTexture, []);
  const gap = 0.02;
  const longX = width >= depth;
  const pw = longX ? 1.72 : 1.13; // X boyutu
  const pd = longX ? 1.13 : 1.72; // Z boyutu
  const nx = Math.max(1, Math.floor((width + gap) / (pw + gap)));
  const nz = Math.max(1, Math.floor((depth + gap) / (pd + gap)));
  const s = Math.min(1, width / (nx * pw + (nx - 1) * gap), depth / (nz * pd + (nz - 1) * gap));
  const cw = pw * s;
  const cd = pd * s;
  const x0 = -((nx * cw + (nx - 1) * gap) / 2) + cw / 2;
  const z0 = -((nz * cd + (nz - 1) * gap) / 2) + cd / 2;
  const panels: [number, number][] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) panels.push([x0 + i * (cw + gap), z0 + j * (cd + gap)]);

  return (
    <group position={[0, y, 0]}>
      {panels.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Alüminyum çerçeve */}
          <mesh position={[0, 0.0175, 0]} castShadow receiveShadow>
            <boxGeometry args={[cw, 0.035, cd]} />
            <meshStandardMaterial color="#b9bec4" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* Hücreler + cam */}
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, longX ? Math.PI / 2 : 0]}>
            <planeGeometry args={longX ? [cd - 0.03, cw - 0.03] : [cw - 0.03, cd - 0.03]} />
            <meshStandardMaterial map={tex} roughness={0.8} metalness={0} envMapIntensity={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Hareketli güverte çatısının eğimi (derece): suyu uzun kenarlara akıtacak kadar hafif */
const LIFT_ROOF_PITCH_DEG = 5;

/**
 * Hareketli güvertenin çatısı (güverte grubunun yerel çerçevesinde, çevre kirişinin üstünde):
 * sırt uzun eksen boyunca ortada, iki yüzey uzun kenarlara iner; uzun kenarlarda oluk, kısa
 * kenarlarda üçgen kapama, sırtta mahya profili. Güneş paneli seçiliyse iki yüzeye de dizilir.
 */
function LiftDeckRoof({
  width,
  length,
  rim,
  frame,
  solar,
}: {
  width: number;
  length: number;
  rim: number;
  frame: string;
  solar: boolean;
}) {
  // Uzun eksen yerel Z olacak şekilde kurulur; uzun eksen X ise grup 90° döndürülür
  const longX = width > length;
  const across = longX ? length : width;
  const along = longX ? width : length;
  const theta = THREE.MathUtils.degToRad(LIFT_ROOF_PITCH_DEG);
  const half = across / 2;
  const rise = half * Math.tan(theta);
  const slope = half / Math.cos(theta);
  const base = LIFT_THICK / 2; // çevre kirişinin üst yüzü
  const T = 0.03;              // çatı paneli kalınlığı

  const gable = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-half, 0);
    sh.lineTo(half, 0);
    sh.lineTo(0, rise);
    sh.closePath();
    return new THREE.ShapeGeometry(sh);
  }, [half, rise]);
  useEffect(() => () => gable.dispose(), [gable]);

  const mat = <meshStandardMaterial color={frame} roughness={0.42} metalness={0.25} envMapIntensity={0.9} />;

  return (
    <group rotation={[0, longX ? Math.PI / 2 : 0, 0]}>
      {[1, -1].map((sx) => (
        <group key={sx} position={[(sx * half) / 2, base + rise / 2, 0]} rotation={[0, 0, -sx * theta]}>
          <Beam args={[slope + 0.01, T, along + 0.01]} radius={0.004} position={[0, T / 2 - 0.004, 0]} castShadow receiveShadow>
            {mat}
          </Beam>
          {solar && <SolarArray width={slope - 0.06} depth={along - 0.06} y={T - 0.004} />}
        </group>
      ))}
      {/* Mahya (sırt) profili */}
      <Beam args={[0.09, 0.035, along + 0.03]} radius={0.006} position={[0, base + rise + T - 0.002, 0]} castShadow>
        {mat}
      </Beam>
      {/* Kısa kenarlarda üçgen kapama */}
      {[1, -1].map((sz) => (
        <mesh key={sz} geometry={gable} position={[0, base, (sz * along) / 2]} rotation={[0, sz > 0 ? 0 : Math.PI, 0]}>
          <meshStandardMaterial color={frame} roughness={0.42} metalness={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Uzun kenarlarda yağmur oluğu */}
      {[1, -1].map((sx) => (
        <Beam key={sx} args={[rim + 0.04, 0.05, along + rim * 2]} radius={0.006} position={[sx * (half + rim / 2), base + 0.025, 0]} castShadow>
          {mat}
        </Beam>
      ))}
    </group>
  );
}

/**
 * Hareketli güverte: havuzun dört köşesindeki kolonlarda yukarı/aşağı hareket eder.
 * Üstü hafif eğimli beşik çatı (su uzun kenarlara akar); aşağıda havuz ağzını tamamen kapatır, yukarıda gölgelik olur.
 */
const LIFT_TRAVEL = 2.3; // m, kapalı konumdan yükselme
const LIFT_THICK = 0.2;

function LiftDeck({
  w,
  l,
  top,
  groundY,
  frame,
  up,
  isNight,
  solar = false,
  direction,
}: {
  w: number;
  l: number;
  top: number;
  groundY: number;
  frame: string;
  up: boolean;
  isNight: boolean;
  /** Üst yüzde kompozit yerine güneş paneli dizisi */
  solar?: boolean;
  /** Makine dairesinin yönü: direkler ona bitişik kenarların dışına dizilir */
  direction: PlatformDirection;
}) {
  // Güverte, kenar döşemesi ve platform ucunun oluşturduğu düz hattın dışına taşar; dört kolon da
  // bu hattın dışında, aynı mesafede durur
  const dw = w + (PLATFORM_END_EXT + 0.03) * 2;
  const dl = l + (PLATFORM_END_EXT + 0.03) * 2;
  const post = 0.15;
  // Direkler makine dairesine bitişik iki kenarın dışında, kenar boyunca: biri havuzun karşı
  // ucuyla, diğeri havuz–makine dairesi birleşimiyle hizalı (köşelerin çaprazında değil)
  const alongX = direction === 'east' || direction === 'west';
  const px = alongX ? dw / 2 - post / 2 : dw / 2 + post / 2 + 0.02;
  const pz = alongX ? dl / 2 + post / 2 + 0.02 : dl / 2 - post / 2;
  const postTop = top + LIFT_TRAVEL + LIFT_THICK + 0.35;
  const postH = postTop - groundY;

  const deckRef = useRef<THREE.Group>(null);
  const progress = useRef(up ? 1 : 0); // 0 = kapalı (havuz üstü), 1 = yukarıda
  const yFor = (p: number) => top + 0.005 + LIFT_THICK / 2 + p * LIFT_TRAVEL;

  useFrame((state, delta) => {
    const target = up ? 1 : 0;
    const p = progress.current;
    if (Math.abs(p - target) < 0.0005) return;
    // ~12 sn uçtan uca, yumuşak kalkış/duruş. İsteğe bağlı çizimde boşta geçen süre ilk karede
    // büyük bir delta olarak gelir; sıçramasın diye kare süresi sınırlanır.
    const step = Math.min(delta, 1 / 30) / 12;
    const next = p < target ? Math.min(target, p + step) : Math.max(target, p - step);
    progress.current = next;
    const eased = next * next * (3 - 2 * next);
    if (deckRef.current) deckRef.current.position.y = yFor(eased);
    state.invalidate();
  });

  const rim = 0.08;

  return (
    <group>
      {/* Köşe kolonları */}
      {[[px, pz], [-px, pz], [px, -pz], [-px, -pz]].map(([x, z], i) => (
        <Beam key={i} args={[post, postH, post]} radius={0.01} position={[x, groundY + postH / 2, z]} castShadow receiveShadow>
          <PowderCoatMaterial color={frame} roughness={0.55} metalness={0.35} />
        </Beam>
      ))}

      {/* Hareket eden güverte */}
      <group ref={deckRef} position={[0, yFor(up ? 1 : 0), 0]}>
        {/* Çevre kirişi */}
        {[
          { args: [dw, LIFT_THICK, rim] as [number, number, number], pos: [0, 0, dl / 2 - rim / 2] as [number, number, number] },
          { args: [dw, LIFT_THICK, rim] as [number, number, number], pos: [0, 0, -dl / 2 + rim / 2] as [number, number, number] },
          { args: [rim, LIFT_THICK, dl - rim * 2] as [number, number, number], pos: [dw / 2 - rim / 2, 0, 0] as [number, number, number] },
          { args: [rim, LIFT_THICK, dl - rim * 2] as [number, number, number], pos: [-dw / 2 + rim / 2, 0, 0] as [number, number, number] },
        ].map((b, i) => (
          <Beam key={i} args={b.args} radius={0.008} position={b.pos} castShadow receiveShadow>
            <PowderCoatMaterial color={frame} roughness={0.55} metalness={0.35} />
          </Beam>
        ))}
        {/* Kolonlara bağlanan köşe kulakları */}
        {[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => (
          <Beam key={`e${i}`} args={[post + 0.08, LIFT_THICK * 0.8, post + 0.08]} radius={0.008} position={[sx * px, 0, sz * pz]} castShadow>
            <PowderCoatMaterial color={frame} roughness={0.55} metalness={0.35} />
          </Beam>
        ))}
        {/* Üst yüz: uzun eksen boyunca sırtı olan hafif eğimli beşik çatı; su uzun kenarlara akar */}
        <LiftDeckRoof width={dw - rim * 2} length={dl - rim * 2} rim={rim} frame={frame} solar={solar} />
        {/* Alt yüz: açık renkli tavan paneli */}
        <mesh position={[0, -LIFT_THICK / 2 + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[dw - rim * 2, dl - rim * 2]} />
          <meshStandardMaterial color="#e9ecee" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Havuz içi basamaklar (iç kaplamayla kaplı). Şelalenin karşısındaki kısa uçta, platform tarafındaki
 * köşeden başlar. Yükseklikler kenar ağzından (POOL_HEIGHT − COPING_T) aşağı 35 cm'lik kademelerle.
 */
function PoolSteps({
  entry,
  halfW,
  halfL,
  platformDirection,
  color,
  claddingTex,
  reserve,
}: {
  entry: 'small_stairs' | 'wide_stairs' | 'bench' | 'none';
  halfW: number;
  halfL: number;
  platformDirection: PlatformDirection;
  color: string;
  claddingTex: THREE.Texture | null;
  /** Kapak bölmesinin kapladığı kenar: basamaklar bu derinlik kadar geri çekilir */
  reserve?: { side: PoolSide; depth: number } | null;
}) {
  const rim = POOL_HEIGHT - COPING_T;
  const rise = 0.35;
  const run = 0.35;
  const floor = BASIN_FLOOR;
  // İç yüzler
  const ix = halfW - LINER;
  const iz = halfL - LINER;
  // Basamak ucu: kısa kenar (genişlik uzunluktan küçükse Z uçları)
  const alongX = halfW <= halfL;
  let sMin = alongX ? -ix : -iz;
  let sMax = -sMin;
  let wallCoord = alongX ? iz : ix; // +uç (şelale −Z ucunda)
  if (reserve) {
    const r = reserve.side;
    if (alongX) {
      if (r === 'west') sMin += reserve.depth;
      else if (r === 'east') sMax -= reserve.depth;
      else if (r === 'south') wallCoord -= reserve.depth;
    } else {
      if (r === 'north') sMin += reserve.depth;
      else if (r === 'south') sMax -= reserve.depth;
      else if (r === 'east') wallCoord -= reserve.depth;
    }
  }
  const span = sMax - sMin;
  // Köşe tarafı: platform bu kısa kenara dikse platforma yakın köşe
  const corner =
    alongX
      ? platformDirection === 'west' ? -1 : 1
      : platformDirection === 'north' ? -1 : 1;

  // (s: kenar boyunca merkezden, d: duvardan içeri) → havuz koordinatı
  type Box = { s0: number; s1: number; d: number; y: number };
  const boxes: Box[] = [];
  // Merdivenin başında, merdiven genişliğince platform yüzeyli sahanlık
  const landings: { s0: number; s1: number }[] = [];
  const L = STEP_LANDING_DEPTH;
  const addStairs = (s0: number, s1: number) => {
    landings.push({ s0, s1 });
    for (let k = 1; k <= 3; k++) boxes.push({ s0, s1, d: L + run * k, y: rim - rise * k });
  };

  if (entry === 'wide_stairs') {
    addStairs(sMin, sMax);
  } else if (entry === 'small_stairs') {
    const w = Math.min(1.0, span * 0.5);
    corner > 0 ? addStairs(sMax - w, sMax) : addStairs(sMin, sMin + w);
  } else if (entry === 'bench') {
    const w = Math.min(0.9, span * 0.4);
    const [a, b] = corner > 0 ? [sMax - w, sMax] : [sMin, sMin + w];
    addStairs(a, b);
    // Oturma bankı: basamakların yanında kenar boyunca
    const [c0, c1] = corner > 0 ? [sMin, a] : [b, sMax];
    boxes.push({ s0: c0, s1: c1, d: 0.45, y: rim - 0.55 });
  }

  const noseColor = useMemo(() => '#' + new THREE.Color(color).multiplyScalar(STEP_NOSE_SHADE).getHexString(), [color]);
  const toPool = (sc: number, y: number, dc: number): [number, number, number] =>
    alongX ? [sc, y, dc] : [dc, y, sc];
  const size = (len: number, h: number, d: number): [number, number, number] =>
    alongX ? [len, h, d] : [d, h, len];

  return (
    <group>
      {landings.map((ld, i) => {
        const len = ld.s1 - ld.s0;
        const sc = (ld.s0 + ld.s1) / 2;
        const dc = wallCoord - L / 2;
        const h = rim - floor;
        return (
          <group key={`l${i}`}>
            {/* Gövde: tabandan kenar hizasına, iç kaplamalı (üstü de kaplama) */}
            <mesh position={toPool(sc, floor + h / 2, dc)}>
              <boxGeometry args={size(len, h, L)} />
              <CladdingMat tex={claddingTex} color={color} sw={len} sh={h} roughness={0.8} metalness={0.01} />
            </mesh>
          </group>
        );
      })}
      {boxes.map((bx, i) => {
        const len = bx.s1 - bx.s0;
        const h = bx.y - floor;
        const sc = (bx.s0 + bx.s1) / 2;
        const dc = wallCoord - bx.d / 2;
        const position: [number, number, number] = alongX ? [sc, floor + h / 2, dc] : [dc, floor + h / 2, sc];
        const args: [number, number, number] = alongX ? [len, h, bx.d] : [bx.d, h, len];
        return (
          <group key={i}>
            <mesh position={position} castShadow receiveShadow>
              <boxGeometry args={args} />
              <CladdingMat tex={claddingTex} color={color} sw={len} sh={Math.max(h, bx.d)} roughness={0.8} metalness={0.01} surface="wallTone" />
            </mesh>
            {/* Basamak ve oturma bankı burnu: ön kenarda kalın, koyu ayırt edici çizgi (üst + ön yüz) */}
            {(() => {
              const front = wallCoord - bx.d;
              // Görünen basamak yüzünün derinliği: basamakta bir adım, bankta bankın tamamı
              const tread = bx.d > L ? run : bx.d;
              const nose = 0.08;
              const EDGE = 0.045;
              const riser = Math.min(rise, bx.y - floor);
              const pos = (dd: number, yy: number): [number, number, number] => toPool((bx.s0 + bx.s1) / 2, yy, dd);
              return (
                <>
                  <mesh position={pos(front + nose / 2, bx.y + 0.002)} rotation={[-Math.PI / 2, 0, alongX ? 0 : Math.PI / 2]}>
                    <planeGeometry args={[len - 0.004, nose]} />
                    <meshBasicMaterial color={noseColor} />
                  </mesh>
                  <mesh position={pos(front - 0.002, bx.y - nose / 2)} rotation={[0, alongX ? Math.PI : -Math.PI / 2, 0]}>
                    <planeGeometry args={[len - 0.004, nose]} />
                    <meshBasicMaterial color={noseColor} />
                  </mesh>
                  {/* Basamak üst yüzünün iki yanında çerçeve çizgisi: her basamak ayrı okunur */}
                  {[bx.s0 + EDGE / 2, bx.s1 - EDGE / 2].map((se, k) => (
                    <mesh key={k} position={toPool(se, bx.y + 0.002, front + tread / 2)} rotation={[-Math.PI / 2, 0, 0]}>
                      <planeGeometry args={alongX ? [EDGE, tread] : [tread, EDGE]} />
                      <meshBasicMaterial color={noseColor} />
                    </mesh>
                  ))}
                  {/* Basamağın dik yüzü gölgeli: basamaklar derinlik kazanır */}
                  <mesh position={pos(front - 0.0015, bx.y - nose - (riser - nose) / 2)} rotation={[0, alongX ? Math.PI : -Math.PI / 2, 0]}>
                    <planeGeometry args={[len - 0.004, riser - nose]} />
                    <meshBasicMaterial color="#000000" transparent opacity={0.34} depthWrite={false} />
                  </mesh>
                </>
              );
            })()}
          </group>
        );
      })}
    </group>
  );
}

/* ─── Platform Furniture ──────────────────────────────── */

/**
 * Loads a PNG texture silently — returns null if the file is missing (no crash).
 * Place /public/person-male.png and /public/person-female.png (top-down view,
 * transparent background) to replace the geometric fallback with a photo-real sprite.
 *
 * Recommended prompt for AI generators:
 *   "top-down aerial overhead view of realistic person lying on white wooden lounge
 *    chair, photorealistic, 4K, PNG transparent background, studio lighting,
 *    ultra detailed skin texture"
 */
function useSafeTexture(url: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(url, t => { t.needsUpdate = true; setTex(t); }, undefined, () => {/* 404 — silent */});
    return () => setTex(null);
  }, [url]);
  return tex;
}

function WineGlass({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.028, 0.028, 0.007, 8]} />
        <meshStandardMaterial color="#cce8f4" transparent opacity={0.75} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.038, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
        <meshStandardMaterial color="#cce8f4" transparent opacity={0.75} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.032, 0.016, 0.09, 8]} />
        <meshStandardMaterial color="#cce8f4" transparent opacity={0.45} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.025, 0.012, 0.05, 8]} />
        <meshStandardMaterial color="#7a0020" transparent opacity={0.82} roughness={0.3} />
      </mesh>
    </group>
  );
}

function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.025, 12]} />
        <meshStandardMaterial color="#7a7a7a" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.45, 8]} />
        <meshStandardMaterial color="#7a7a7a" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.035, 16]} />
        <meshStandardMaterial color="#9a9a9a" metalness={0.4} roughness={0.4} />
      </mesh>
      <WineGlass position={[-0.09, 0.535, 0]} />
      <WineGlass position={[ 0.09, 0.535, 0]} />
    </group>
  );
}

/* Person lying on a lounge chair.
   If /public/person-{gender}.png exists → photo-real sprite on horizontal plane.
   Otherwise → high-poly ellipsoid geometric fallback.
   Person lies along Z: head at -Z (~-0.50), feet at +Z (~+0.95). */
function PersonOnChair({ gender }: { gender: 'male' | 'female' }) {
  const tex = useSafeTexture(`/person-${gender}.png`);
  if (tex) {
    return (
      <mesh position={[0, 0.415, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.72, 1.68]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.08} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  // ── Geometric fallback ────────────────────────────────────────
  const f   = gender === 'female';
  const skin = f ? '#f3b590' : '#c8844e';
  const suit = f ? '#e8348c' : '#1a3f90';
  const hair = f ? '#180804' : '#2c1808';

  type Part = { s: [number,number,number]; p: [number,number,number]; c: string; r?: number };

  const shared: Part[] = [
    // neck
    { s: [0.038, 0.038, 0.092], p: [0, 0.447, -0.375], c: skin },
    // upper legs
    { s: [0.085, 0.080, 0.300], p: [-0.063, 0.393, 0.522], c: skin },
    { s: [0.085, 0.080, 0.300], p: [ 0.063, 0.393, 0.522], c: skin },
    // lower legs
    { s: [0.068, 0.064, 0.255], p: [-0.060, 0.383, 0.818], c: skin },
    { s: [0.068, 0.064, 0.255], p: [ 0.060, 0.383, 0.818], c: skin },
    // feet
    { s: [0.060, 0.042, 0.092], p: [-0.060, 0.380, 0.944], c: skin, r: 0.7 },
    { s: [0.060, 0.042, 0.092], p: [ 0.060, 0.380, 0.944], c: skin, r: 0.7 },
    // arms
    { s: [0.058, 0.054, 0.290], p: [-(f ? 0.240 : 0.295), 0.412, 0.058], c: skin },
    { s: [0.058, 0.054, 0.290], p: [ (f ? 0.240 : 0.295), 0.412, 0.058], c: skin },
  ];

  const female: Part[] = [
    // head
    { s: [0.088, 0.092, 0.088], p: [0, 0.538, -0.502], c: skin, r: 0.50 },
    // hair cap
    { s: [0.107, 0.112, 0.107], p: [0, 0.593, -0.525], c: hair, r: 0.85 },
    // long hair draping
    { s: [0.162, 0.245, 0.118], p: [0, 0.474, -0.678], c: hair, r: 0.90 },
    // hair side wisps
    { s: [0.065, 0.180, 0.085], p: [-0.095, 0.468, -0.655], c: hair, r: 0.90 },
    { s: [0.065, 0.180, 0.085], p: [ 0.095, 0.468, -0.655], c: hair, r: 0.90 },
    // shoulders
    { s: [0.318, 0.042, 0.046], p: [0, 0.446, -0.258], c: skin },
    // torso (bikini)
    { s: [0.192, 0.124, 0.490], p: [0, 0.418, -0.038], c: suit, r: 0.72 },
    // hips (bikini bottom)
    { s: [0.228, 0.114, 0.292], p: [0, 0.408, 0.278], c: suit, r: 0.72 },
    // visible midriff skin strip
    { s: [0.170, 0.090, 0.100], p: [0, 0.418, 0.100], c: skin },
  ];

  const male: Part[] = [
    // head
    { s: [0.092, 0.096, 0.092], p: [0, 0.540, -0.504], c: skin, r: 0.50 },
    // hair
    { s: [0.102, 0.106, 0.102], p: [0, 0.578, -0.526], c: hair, r: 0.85 },
    // shoulders (wide)
    { s: [0.380, 0.046, 0.050], p: [0, 0.448, -0.255], c: skin },
    // torso (swim trunks top = skin)
    { s: [0.248, 0.132, 0.310], p: [0, 0.420, -0.120], c: skin },
    // swim trunks
    { s: [0.228, 0.118, 0.310], p: [0, 0.410, 0.218], c: suit, r: 0.72 },
    // lower torso connection
    { s: [0.215, 0.118, 0.180], p: [0, 0.413, 0.048], c: skin },
  ];

  const parts = [...shared, ...(f ? female : male)];

  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} scale={p.s} position={p.p} castShadow>
          <sphereGeometry args={[1, 32, 22]} />
          <meshStandardMaterial color={p.c} roughness={p.r ?? 0.62} />
        </mesh>
      ))}
    </group>
  );
}

function LoungeChair({
  position, rotY = 0,
}: {
  position: [number, number, number];
  rotY?: number;
}) {
  const wood    = '#b8742a';
  const cushion = '#f4efe6';
  /* Chair runs along Z: foot at +Z, backrest at -Z end.
     Seat is completely FLAT. Backrest is a separate raised section.  */
  const seatZ = [-0.18, 0.00, 0.18, 0.36, 0.54, 0.72, 0.88] as number[];

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Side rails */}
      {([-0.30, 0.30] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 0.22, 0.35]} castShadow>
          <boxGeometry args={[0.04, 0.06, 1.20]} />
          <meshStandardMaterial color={wood} roughness={0.65} />
        </mesh>
      ))}

      {/* Flat seat slats */}
      {seatZ.map((z, i) => (
        <mesh key={i} position={[0, 0.26, z]} castShadow>
          <boxGeometry args={[0.66, 0.04, 0.14]} />
          <meshStandardMaterial color={cushion} roughness={0.85} />
        </mesh>
      ))}

      {/* Backrest — anchored at seat's -Z end, tilts AWAY from pool (toward -Z).
          Slats arranged vertically in group local, then group rotated [-angle].
          rotX(-angle): local +Y tilts toward -Z = away from pool ✓  */}
      <group position={[0, 0.26, -0.18]} rotation={[-0.58, 0, 0]}>
        {/* Side rails (vertical) */}
        {([-0.30, 0.30] as number[]).map((x, i) => (
          <mesh key={i} position={[x, 0.24, 0]} castShadow>
            <boxGeometry args={[0.04, 0.52, 0.04]} />
            <meshStandardMaterial color={wood} roughness={0.65} />
          </mesh>
        ))}
        {/* Slats: evenly spaced up the backrest */}
        {([0.06, 0.20, 0.34, 0.46] as number[]).map((y, i) => (
          <mesh key={i} position={[0, y, 0]} castShadow>
            <boxGeometry args={[0.66, 0.04, 0.13]} />
            <meshStandardMaterial color={cushion} roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* 4 Legs */}
      {([[-0.28, -0.14], [0.28, -0.14], [-0.28, 0.82], [0.28, 0.82]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.10, z]} castShadow>
          <boxGeometry args={[0.05, 0.22, 0.05]} />
          <meshStandardMaterial color={wood} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function Platform({
  halfW,
  halfL,
  top,
  direction,
  frameColor,
  showStairs = true,
  showRailings = true,
  extended = true,
  groundY = 0,
  blockStairs = false,
  openEnds,
}: {
  halfW: number;
  halfL: number;
  top: number;
  direction: PlatformDirection;
  frameColor: string;
  showStairs?: boolean;
  showRailings?: boolean;
  extended?: boolean;
  blockStairs?: boolean;
  /** Platform boyunca -/+ uçlar köşe terasına bağlanıyorsa korkuluk konmaz */
  openEnds?: { neg: boolean; pos: boolean };
  /** Zeminin platforma göre yüksekliği (gömülü kurulumda > 0) */
  groundY?: number;
}) {
  // Tam gömülüde güverte zemin hizasındadır; merdivene gerek kalmaz
  const hasStairs = showStairs && top - groundY > 0.2;
  const deckThickness = 0.1;
  const deckY = top - deckThickness / 2;

  // pw/pd: pool-length axis vs outward axis.
  // "extension" = the outer strip beyond the machine room.
  // When off, outward depth shrinks from PLATFORM_DEPTH to 60% (machine room only).
  const sideLen = (direction === 'east' || direction === 'west' ? halfL * 2 : halfW * 2) + PLATFORM_END_EXT * 2;
  const depthFull    = PLATFORM_DEPTH;           // 2.0 m
  const depthCompact = PLATFORM_DEPTH * 0.6;     // 1.2 m — machine room only
  const depth = extended ? depthFull : depthCompact;
  const innerGap = COPING_W - FRAME_T;           // gap between pool wall and platform inner edge

  let pw = 0, pd = 0, cx = 0, cz = 0;

  if (direction === 'east') {
    pw = depth; pd = sideLen;
    cx = halfW + innerGap + depth / 2; cz = 0;
  } else if (direction === 'west') {
    pw = depth; pd = sideLen;
    cx = -halfW - innerGap - depth / 2; cz = 0;
  } else if (direction === 'north') {
    pw = sideLen; pd = depth;
    cx = 0; cz = -halfL - innerGap - depth / 2;
  } else {
    pw = sideLen; pd = depth;
    cx = 0; cz = halfL + innerGap + depth / 2;
  }

  return (
    <group position={[cx, 0, cz]}>
      {/* Closed block under the deck — machine/equipment room */}
      <PlatformBlock
        pw={pw}
        pd={pd}
        top={top - deckThickness}
        direction={direction}
        frameColor={frameColor}
        fillFull={!extended}
      />

      {/* Deck floor */}
      <Beam args={[pw, deckThickness, pd]} radius={0.01} position={[0, deckY, 0]} castShadow receiveShadow>
        <DeckSurfaceMaterial />
      </Beam>

      {/* Köşe ayakları — uzatmada dış şerit makine dairesinden konsol çıkar, ayak yok */}
      {!extended && (
        <PlatformLegs pw={pw} pd={pd} top={top - deckThickness} bottom={groundY} color={frameColor} />
      )}

      {/* Railings: outer + 1 short side opposite the stairs (optional) */}
      {showRailings && (
        <PlatformRailings
          pw={pw}
          pd={pd}
          deckTop={top}
          direction={direction}
          color={frameColor}
          showStairs={hasStairs}
          openEnds={openEnds}
        />
      )}

      {/* Stairs descending from one corner (optional) */}
      {hasStairs && (
        <Stairs
          pw={pw}
          pd={pd}
          deckTop={top}
          groundY={groundY}
          direction={direction}
          frameColor={frameColor}
          block={blockStairs}
        />
      )}

      {/* Uzatmalı platformda dekor: kenar terasıyla aynı kural (uzunluğa göre şezlong sayısı) */}
      {extended && (
        <group position={[0, top, 0]} rotation={[0, DECK_ROT[direction], 0]}>
          <DeckDecor
            len={direction === 'east' || direction === 'west' ? pd : pw}
            depth={direction === 'east' || direction === 'west' ? pw : pd}
          />
        </group>
      )}
    </group>
  );
}

function PlatformBlock({
  pw,
  pd,
  top,
  direction,
  frameColor,
  fillFull = false,
}: {
  pw: number;
  pd: number;
  top: number;
  direction: PlatformDirection;
  frameColor: string;
  fillFull?: boolean;
}) {
  const halfPw = pw / 2;
  const halfPd = pd / 2;
  const cabH = top - 0.04;
  const innerExtension = COPING_W - FRAME_T;
  // outwardDepth: how far the platform extends away from the pool wall.
  // fillFull: compact mode — machine room covers 100% (no open outer strip).
  const outwardDepth = direction === 'east' || direction === 'west' ? pw : pd;
  const cabPartial = fillFull ? outwardDepth : outwardDepth * 0.6;

  let cabX1: number, cabX2: number, cabZ1: number, cabZ2: number;
  if (direction === 'east') {
    cabX1 = -halfPw - innerExtension;
    cabX2 = -halfPw + cabPartial;
    cabZ1 = -halfPd;
    cabZ2 = halfPd;
  } else if (direction === 'west') {
    cabX1 = halfPw - cabPartial;
    cabX2 = halfPw + innerExtension;
    cabZ1 = -halfPd;
    cabZ2 = halfPd;
  } else if (direction === 'north') {
    cabX1 = -halfPw;
    cabX2 = halfPw;
    cabZ1 = -halfPd - innerExtension;
    cabZ2 = -halfPd + cabPartial;
  } else {
    cabX1 = -halfPw;
    cabX2 = halfPw;
    cabZ1 = halfPd - cabPartial;
    cabZ2 = halfPd + innerExtension;
  }

  const cabW = cabX2 - cabX1;
  const cabD = cabZ2 - cabZ1;
  const cabCx = (cabX1 + cabX2) / 2;
  const cabCz = (cabZ1 + cabZ2) / 2;

  // Vent placement on the outer-facing wall of the cabinet
  const ventW = 0.55;
  const ventH = 0.2;
  let ventPos: [number, number, number];
  let ventRot: [number, number, number];
  if (direction === 'east') {
    ventPos = [cabX2 - 0.005, cabH * 0.55, cabCz];
    ventRot = [0, Math.PI / 2, 0];
  } else if (direction === 'west') {
    ventPos = [cabX1 + 0.005, cabH * 0.55, cabCz];
    ventRot = [0, Math.PI / 2, 0];
  } else if (direction === 'north') {
    ventPos = [cabCx, cabH * 0.55, cabZ2 - 0.005];
    ventRot = [0, 0, 0];
  } else {
    ventPos = [cabCx, cabH * 0.55, cabZ1 + 0.005];
    ventRot = [0, 0, 0];
  }

  // Ön yüz paneli ve ızgara, gövdenin dış yüzünün önüne oturur
  const PANEL = 0.012;
  const axisX = direction === 'east' || direction === 'west';
  const faceSign = direction === 'east' || direction === 'north' ? 1 : -1;
  const faceCoord = direction === 'east' ? cabX2 : direction === 'west' ? cabX1 : direction === 'north' ? cabZ2 : cabZ1;
  const frontArgs: [number, number, number] = axisX ? [PANEL, cabH - 0.004, cabD - 0.006] : [cabW - 0.006, cabH - 0.004, PANEL];
  const frontPos: [number, number, number] = axisX
    ? [faceCoord + faceSign * PANEL / 2, cabH / 2, cabCz]
    : [cabCx, cabH / 2, faceCoord + faceSign * PANEL / 2];
  if (axisX) ventPos[0] = faceCoord + faceSign * (PANEL + 0.006);
  else ventPos[2] = faceCoord + faceSign * (PANEL + 0.006);

  return (
    <group>
      {/* Kapalı gövde: çerçeve renginde */}
      <Beam args={[cabW, cabH, cabD]} radius={0.01} position={[cabCx, cabH / 2, cabCz]} castShadow receiveShadow>
        <PowderCoatMaterial color={frameColor} roughness={0.6} metalness={0.25} />
      </Beam>
      {/* Havalandırmalı dış ön yüz: çerçeve renginden bağımsız, daima antrasit */}
      <Beam args={frontArgs} radius={0.004} position={frontPos}>
        <PowderCoatMaterial color={MACHINE_ROOM_COLOR} roughness={0.6} metalness={0.25} />
      </Beam>
      {/* Ventilation grille on the outer face */}
      <mesh position={ventPos} rotation={ventRot}>
        <boxGeometry args={[ventW, ventH, 0.02]} />
        <meshStandardMaterial color="#15191f" roughness={0.7} />
      </mesh>
    </group>
  );
}

function PlatformLegs({
  pw,
  pd,
  top,
  bottom = 0,
  color,
}: {
  pw: number;
  pd: number;
  top: number;
  bottom?: number;
  color: string;
}) {
  const halfPw = pw / 2;
  const halfPd = pd / 2;
  const corners: [number, number][] = [
    [halfPw, halfPd],
    [-halfPw, halfPd],
    [halfPw, -halfPd],
    [-halfPw, -halfPd],
  ];
  return (
    <group>
      {corners.map(([x, z], i) => (
        <Beam args={[FRAME_T, top - bottom, FRAME_T]} key={i} position={[x, (top + bottom) / 2, z]} castShadow>
          <PowderCoatMaterial color={color} />
        </Beam>
      ))}
    </group>
  );
}

function PlatformRailings({
  pw,
  pd,
  deckTop,
  direction,
  color,
  showStairs = true,
  openEnds,
}: {
  pw: number;
  pd: number;
  deckTop: number;
  direction: PlatformDirection;
  color: string;
  showStairs?: boolean;
  openEnds?: { neg: boolean; pos: boolean };
}) {
  // Inner side (touching pool) gets no railing.
  // The "stair side" gets no railing either — stairs descend there.
  // Outer side + opposite-of-stairs side get railings.
  const halfPw = pw / 2;
  const halfPd = pd / 2;

  // Outer side direction (away from pool) and stair side direction.
  // Inner side is the one touching the pool.
  // For east platform, inner side is -X, outer is +X.
  // Let's render railings on:
  //  - outer side
  //  - one perpendicular side (the one OPPOSITE the stairs)
  // Stair side is fixed: for east/west platforms, stairs are at +Z end; for north/south, at +X end.

  const railingColor = color;
  const railHeight = 1.05;
  const postSpacing = 1.2;
  const postR = 0.025;
  const stairWidth = 0.9;

  // Build a railing from (x1,z1) to (x2,z2)
  const railings: { from: [number, number]; to: [number, number] }[] = [];

  // Stairs descend OUTWARD perpendicular to pool, at one corner of the outer edge.
  // For east/west: stairs at +Z corner. Outer edge has a gap there.
  // For north/south: stairs at +X corner.
  if (direction === 'east' || direction === 'west') {
    const outerX = direction === 'east' ? halfPw : -halfPw;
    railings.push({ from: [outerX, -halfPd], to: [outerX, halfPd] });
    if (!openEnds?.neg) railings.push({ from: [-halfPw, -halfPd], to: [halfPw, -halfPd] });
    if (!showStairs) {
      // No gap — full railing on stair side too
      if (!openEnds?.pos) railings.push({ from: [-halfPw, halfPd], to: [halfPw, halfPd] });
    } else {
      // Merdiven boşluğu (merdiven makine dairesi dış yüzüne hizalı; uzatmada da yerinde kalır)
      const [g0, g1] = direction === 'east'
        ? [-halfPw + STAIR_OUTER - stairWidth, -halfPw + STAIR_OUTER]
        : [halfPw - STAIR_OUTER, halfPw - STAIR_OUTER + stairWidth];
      if (g0 > -halfPw + 0.05) railings.push({ from: [-halfPw, halfPd], to: [g0, halfPd] });
      if (g1 < halfPw - 0.05) railings.push({ from: [g1, halfPd], to: [halfPw, halfPd] });
    }
  } else {
    const outerZ = direction === 'south' ? halfPd : -halfPd;
    railings.push({ from: [-halfPw, outerZ], to: [halfPw, outerZ] });
    if (!openEnds?.neg) railings.push({ from: [-halfPw, -halfPd], to: [-halfPw, halfPd] });
    if (!showStairs) {
      if (!openEnds?.pos) railings.push({ from: [halfPw, -halfPd], to: [halfPw, halfPd] });
    } else {
      const [g0, g1] = direction === 'north'
        ? [halfPd - STAIR_OUTER, halfPd - STAIR_OUTER + stairWidth]
        : [-halfPd + STAIR_OUTER - stairWidth, -halfPd + STAIR_OUTER];
      if (g0 > -halfPd + 0.05) railings.push({ from: [halfPw, -halfPd], to: [halfPw, g0] });
      if (g1 < halfPd - 0.05) railings.push({ from: [halfPw, g1], to: [halfPw, halfPd] });
    }
  }

  return (
    <group position={[0, deckTop, 0]}>
      {railings.map((r, i) => (
        <RailingRun
          key={i}
          from={r.from}
          to={r.to}
          height={railHeight}
          spacing={postSpacing}
          color={railingColor}
          postR={postR}
        />
      ))}
    </group>
  );
}

function RailingRun({
  from,
  to,
  height,
  spacing,
  color,
  postR,
}: {
  from: [number, number];
  to: [number, number];
  height: number;
  spacing: number;
  color: string;
  postR: number;
}) {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;

  // Posts every "spacing" units, plus end posts.
  const posts: number[] = [];
  const steps = Math.max(1, Math.round(length / spacing));
  for (let i = 0; i <= steps; i++) {
    posts.push((i / steps) * length - length / 2);
  }

  // 4 horizontal rails at different heights
  const railYs = [0.25, 0.5, 0.78, height];

  return (
    <group position={[cx, 0, cz]} rotation={[0, -angle, 0]}>
      {posts.map((u, i) => (
        <mesh key={`p${i}`} position={[u, height / 2, 0]} castShadow>
          <cylinderGeometry args={[postR, postR, height, 10]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {railYs.map((y, i) => (
        <mesh
          key={`r${i}`}
          position={[0, y, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[postR, postR, length, 10]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Stairs({
  pw,
  pd,
  deckTop,
  groundY = 0,
  direction,
  frameColor,
  block = false,
}: {
  pw: number;
  pd: number;
  deckTop: number;
  groundY?: number;
  direction: PlatformDirection;
  frameColor: string;
  /** Kapalı blok basamaklar (gövde renginde, üstü ahşap) — açık basamak yerine */
  block?: boolean;
}) {
  // Stairs descend from deck level to ground, ~30 cm per step (5 steps when above ground).
  const totalRise = deckTop - groundY;
  const steps = Math.max(1, Math.round(totalRise / 0.3));
  const stepRise = totalRise / steps;
  const stepRun = 0.32;
  const stairWidth = 0.9;

  const halfPw = pw / 2;
  const halfPd = pd / 2;

  // Stair origin: at one corner of the deck, descending OUTWARD perpendicular to inner edge.
  // For east/west platform: stairs at +Z corner descending in +Z direction
  // For north/south platform: stairs at +X corner descending in +X direction
  let originX = 0;
  let originZ = 0;
  let descendX = 0;
  let descendZ = 0;
  let alignAlongX = true;

  // Stairs descend PARALLEL to the pool side, at the front edge. Merdivenin dış kenarı makine
  // dairesinin dış yüzüne hizalıdır (merdivene bakan kişinin sağı; havuz tarafındaki hareketli
  // güverte kolonuyla çakışmaz). Dış uzatma eklense de merdivenin yeri değişmez.
  if (direction === 'east' || direction === 'west') {
    // Havuz tarafı: doğuda −X, batıda +X
    originX =
      direction === 'east' ? -halfPw + STAIR_OUTER - stairWidth / 2 : halfPw - STAIR_OUTER + stairWidth / 2;
    originZ = halfPd; // front edge
    descendZ = 1;
    alignAlongX = false;
  } else {
    // Havuz tarafı: kuzeyde +Z, güneyde −Z
    originX = halfPw; // front edge (descent starts here)
    originZ =
      direction === 'north' ? halfPd - STAIR_OUTER + stairWidth / 2 : -halfPd + STAIR_OUTER - stairWidth / 2;
    descendX = 1;
    alignAlongX = true;
  }

  return (
    <group>
      {Array.from({ length: steps }).map((_, i) => {
        const stepIdx = i + 1;
        const yTop = deckTop - stepRise * stepIdx;
        const offset = stepRun * stepIdx;
        const cx = originX + descendX * offset;
        const cz = originZ + descendZ * offset;
        const rotY = alignAlongX ? Math.PI / 2 : 0;
        if (block) {
          const h = yTop - groundY;
          if (h < 0.02) return null; // en alt basamak zemindir
          return (
            <group key={i}>
              <Beam args={[stairWidth, h, stepRun]} radius={0.006} position={[cx, groundY + h / 2, cz]} rotation={[0, rotY, 0]} castShadow receiveShadow>
                <PowderCoatMaterial color={frameColor} roughness={0.6} metalness={0.2} />
              </Beam>
              <Beam args={[stairWidth + 0.02, 0.04, stepRun + 0.02]} radius={0.008} position={[cx, yTop + 0.02, cz]} rotation={[0, rotY, 0]} castShadow receiveShadow>
                <DeckSurfaceMaterial />
              </Beam>
            </group>
          );
        }
        return (
          <Beam
            key={i}
            args={[stairWidth, 0.05, stepRun]}
            radius={0.008}
            position={[cx, yTop + 0.025, cz]}
            rotation={[0, alignAlongX ? Math.PI / 2 : 0, 0]}
            castShadow
            receiveShadow
          >
            <DeckSurfaceMaterial />
          </Beam>
        );
      })}

      {/* Stair handrails on both sides (blok basamakta yok) */}
      {!block && (<>
      <StairRail
        originX={originX}
        originZ={originZ}
        descendX={descendX}
        descendZ={descendZ}
        steps={steps}
        stepRun={stepRun}
        stepRise={stepRise}
        deckTop={deckTop}
        groundY={groundY}
        sideOffset={alignAlongX ? stairWidth / 2 : -stairWidth / 2}
        sideAxis={alignAlongX ? 'z' : 'x'}
        color={frameColor}
      />
      <StairRail
        originX={originX}
        originZ={originZ}
        descendX={descendX}
        descendZ={descendZ}
        steps={steps}
        stepRun={stepRun}
        stepRise={stepRise}
        deckTop={deckTop}
        groundY={groundY}
        sideOffset={alignAlongX ? -stairWidth / 2 : stairWidth / 2}
        sideAxis={alignAlongX ? 'z' : 'x'}
        color={frameColor}
      />
      </>)}
    </group>
  );
}

function StairRail({
  originX,
  originZ,
  descendX,
  descendZ,
  steps,
  stepRun,
  stepRise,
  deckTop,
  groundY = 0,
  sideOffset,
  sideAxis,
  color,
}: {
  originX: number;
  originZ: number;
  descendX: number;
  descendZ: number;
  steps: number;
  stepRun: number;
  stepRise: number;
  deckTop: number;
  groundY?: number;
  sideOffset: number;
  sideAxis: 'x' | 'z';
  color: string;
}) {
  const totalRun = stepRun * steps;
  const startX = originX + (sideAxis === 'x' ? sideOffset : 0);
  const startZ = originZ + (sideAxis === 'z' ? sideOffset : 0);
  const endX = startX + descendX * totalRun;
  const endZ = startZ + descendZ * totalRun;

  const railHeight = 0.95;
  const startY = deckTop + railHeight;
  const endY = groundY + railHeight;

  const midX = (startX + endX) / 2;
  const midZ = (startZ + endZ) / 2;
  const midY = (startY + endY) / 2;

  const dx = endX - startX;
  const dy = endY - startY;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dy, dz);

  // Compute rotation to align cylinder (default Y axis) with the rail vector.
  const direction = new THREE.Vector3(dx, dy, dz).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
  const euler = new THREE.Euler().setFromQuaternion(quaternion);

  return (
    <group>
      {/* Top handrail (sloped) */}
      <mesh
        position={[midX, midY, midZ]}
        rotation={[euler.x, euler.y, euler.z]}
        castShadow
      >
        <cylinderGeometry args={[0.025, 0.025, length, 10]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Vertical posts at each step */}
      {Array.from({ length: steps + 1 }).map((_, i) => {
        const u = i * stepRun;
        const px = startX + (descendX * u);
        const pz = startZ + (descendZ * u);
        const stepY = deckTop - stepRise * i;
        const postH = railHeight;
        return (
          <mesh
            key={i}
            position={[px, stepY + postH / 2, pz]}
            castShadow
          >
            <cylinderGeometry args={[0.022, 0.022, postH, 10]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function Waterfall({
  halfL,
  top,
}: {
  halfL: number;
  top: number;
}) {
  // Stainless steel cascade: rectangular post + half-annulus ("C") sheet
  // bent over the top. The arch is a SHEET (rectangular cross-section), not a
  // tube — extruded from a 2D C-shape so it matches the real product.
  const archR = 0.32;       // outer radius of the C
  const sheetT = 0.05;      // sheet metal thickness
  const innerR = archR - sheetT;
  const postH = 0.5;
  const postW = 0.30;       // width along X (extrusion depth of the C)
  const postT = 0.075;      // post depth in Z direction (slightly thicker than sheet)

  const baseZ = -halfL - 0.08; // seated back on the wooden coping (not over the water)
  const postY = top + postH / 2;
  const postTopY = top + postH;

  // 2D side profile — half annulus opened at the bottom
  const archGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-archR, 0);
    // Outer arc: π → 0 through top (clockwise = decreasing angles)
    shape.absarc(0, 0, archR, Math.PI, 0, true);
    shape.lineTo(innerR, 0);
    // Inner arc: 0 → π through top (counter-clockwise = increasing angles)
    shape.absarc(0, 0, innerR, 0, Math.PI, false);
    shape.lineTo(-archR, 0);
    return new THREE.ExtrudeGeometry(shape, {
      depth: postW,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      bevelSegments: 1,
      curveSegments: 56,
    });
  }, [archR, innerR, postW]);

  const steelMatProps = {
    color: '#d8dde4',
    metalness: 0.6,
    roughness: 0.3,
  };

  return (
    <group>
      {/* Rectangular post */}
      <mesh
        position={[0, postY, baseZ + postT / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[postW, postH, postT]} />
        <meshStandardMaterial {...steelMatProps} />
      </mesh>

      {/* C-shaped sheet metal arch sitting on the post */}
      <mesh
        geometry={archGeometry}
        position={[postW / 2, postTopY, baseZ + archR]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMatProps} />
      </mesh>
    </group>
  );
}

function PoolCover({
  w,
  l,
  top,
  waterY,
  frame,
  direction,
  closed = true,
  innerColor,
  claddingTex,
  landingSide,
}: {
  w: number;
  l: number;
  top: number;
  waterY: number;
  frame: string;
  direction: PlatformDirection;
  closed?: boolean;
  innerColor: string;
  claddingTex: THREE.Texture | null;
  /** Havuz içi merdiven sahanlığının duvarı: lameller o uçta sahanlık kadar kısa kalır */
  landingSide?: PoolSide;
}) {
  // Otomatik lamelli rulo kapak. Tambur, makine dairesinin KARŞI duvarı boyunca
  // havuz tabanından yükselen kapalı bir bölmenin (COVER_BAY_DEPTH) içinde gizlidir.
  // Lameller su seviyesinde bölmenin ön yüzündeki yarıktan çıkar ve duvara dik
  // olarak makine dairesine doğru kapanır. O kenarın ahşap kenar döşemesi kalkar;
  // bölmenin ve kenarın üstü havuz kaplamasıyla kapatılır.
  // Yerel çerçeve: lameller +Z yönünde ilerler; grup döndürülerek +Z makine dairesine bakar.
  const acrossX = direction === 'east' || direction === 'west';
  const span = acrossX ? w : l;   // lamellerin ilerlediği eksen
  const across = acrossX ? l : w; // tambur ekseni
  const rotY =
    direction === 'east' ? Math.PI / 2
    : direction === 'west' ? -Math.PI / 2
    : direction === 'north' ? Math.PI
    : 0;
  const halfSpan = span / 2;
  const out = COPING_W - FRAME_T;

  // Bölme
  const bayBack = -halfSpan + PANEL_T - 0.005;
  const bayFront = -halfSpan + PANEL_T + COVER_BAY_DEPTH;
  const bayW = across - PANEL_T * 2 - 0.01;
  const bayBottom = BASIN_FLOOR;
  const bayTop = top - COPING_T;
  const bayH = bayTop - bayBottom;

  // Kenar kapağı: kaldırılan kenar döşemesinin yerini + bölmenin üstünü kaplar.
  // Doğu/batı kenarındaki döşeme kısa kenar döşemelerinin arasında kalır, kuzey/güney
  // kenarındaki ise köşeleri de kapsar (Coping ile aynı kurgu).
  const lidOuter = -halfSpan - out - (COPING_W - out) / 2;
  const lidLen = acrossX ? across - (COPING_W - out) : across + out * 2;
  const lidDepth = bayFront - lidOuter;
  const lidCz = (lidOuter + bayFront) / 2;

  const endInset = PANEL_T + 0.06;
  const coverW = bayW - 0.06;                // a bit narrower than the inner span
  const yCover = waterY + 0.04;              // rests just above the water surface

  // Sahanlığın duvarı yerel çerçevede hangi uçta: +X/−X (lamel genişliği kısalır),
  // +Z (kapanma ucu geri çekilir) ya da −Z (tambur tarafı, lameller sahanlığın önünden çıkar)
  let xMin = -coverW / 2;
  let xMax = coverW / 2;
  let zStart = bayFront + 0.01;
  let zClosed = halfSpan - endInset;
  if (landingSide) {
    const n = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[landingSide];
    // Yerel +X ve +Z eksenlerinin dünya yönleri (Y ekseni etrafında rotY dönüşü)
    const lx = n[0] * Math.cos(rotY) - n[1] * Math.sin(rotY);
    const lz = n[0] * Math.sin(rotY) + n[1] * Math.cos(rotY);
    const L = STEP_LANDING_DEPTH;
    if (lx > 0.5) xMax -= L;
    else if (lx < -0.5) xMin += L;
    else if (lz > 0.5) zClosed -= L;
    else if (lz < -0.5) zStart += L;
  }
  const slatWidth = xMax - xMin;
  const slatX = (xMin + xMax) / 2;
  const travel = zClosed - zStart;

  const slatW = 0.14;
  const N = Math.max(4, Math.round(travel / slatW));
  const slatLen = travel / N;
  const slatGap = 0.012;

  const slatRefs = useRef<(THREE.Mesh | null)[]>([]);
  const leadRef = useRef<THREE.Group | null>(null);
  const progress = useRef(0); // 0 = retracted, 1 = fully closed

  const applyProgress = (p: number) => {
    const extended = p * N;
    for (let i = 0; i < N; i++) {
      const m = slatRefs.current[i];
      if (m) m.visible = i + 1 <= extended;
    }
    const lead = leadRef.current;
    if (lead) {
      lead.position.z = zStart + travel * p;
      lead.visible = p > 0.01;
    }
  };

  // Ölçü/yön değişince lameller yeni ızgaraya göre yeniden gösterilsin
  useEffect(() => { applyProgress(progress.current); });

  useFrame((state, delta) => {
    const target = closed ? 1 : 0;
    const p = progress.current;
    if (Math.abs(p - target) < 0.0005) return;
    // ~8 sn uçtan uca, iki yöne de; boşta geçen süre ilk karede sıçratmasın diye kare süresi sınırlanır
    const step = Math.min(delta, 1 / 30) / 8;
    const next = p < target ? Math.min(target, p + step) : Math.max(target, p - step);
    progress.current = next;
    applyProgress(next);
    state.invalidate(); // keep animating under demand rendering
  });

  const slatMat = { color: '#c9ced3', roughness: 0.55, metalness: 0.15 };

  return (
    <group rotation={[0, rotY, 0]}>
      {/* Tambur bölmesi: tabandan kenar hizasına kadar kapalı gövde */}
      <mesh position={[0, bayBottom + bayH / 2, (bayBack + bayFront) / 2]}>
        <boxGeometry args={[bayW, bayH, bayFront - bayBack]} />
        <meshStandardMaterial color={innerColor} roughness={0.85} />
      </mesh>
      {/* Bölmenin havuza bakan yüzü: iç kaplama */}
      <mesh position={[0, bayBottom + bayH / 2, bayFront + 0.002]}>
        <planeGeometry args={[bayW, bayH]} />
        <CladdingMat tex={claddingTex} color={innerColor} sw={bayW} sh={bayH} surface="wall" corners={[true, true]} />
      </mesh>
      {/* Lamellerin çıktığı yarık */}
      <mesh position={[0, yCover, bayFront + 0.004]}>
        <planeGeometry args={[coverW + 0.02, 0.05]} />
        <meshStandardMaterial color="#15191f" roughness={0.8} />
      </mesh>

      {/* Kenar kapağı: ahşap kenar döşemesinin yerine kaplama */}
      <Beam args={[lidLen, COPING_T, lidDepth]} radius={0.008} position={[0, top - COPING_T / 2, lidCz]}>
        <meshStandardMaterial color={innerColor} roughness={0.85} />
      </Beam>
      <mesh position={[0, top + 0.002, lidCz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lidLen - 0.01, lidDepth - 0.01]} />
        <CladdingMat tex={claddingTex} color={innerColor} sw={lidLen} sh={lidDepth} />
      </mesh>

      {/* Slats — laid flat just above the water, revealed one by one as it closes */}
      {Array.from({ length: N }, (_, i) => {
        const zc = zStart + slatLen * (i + 0.5);
        return (
          <mesh
            key={i}
            ref={(m) => { slatRefs.current[i] = m; }}
            position={[slatX, yCover, zc]}
            visible={false}
          >
            <boxGeometry args={[slatWidth, 0.022, slatLen - slatGap]} />
            <meshStandardMaterial {...slatMat} />
          </mesh>
        );
      })}

      {/* Leading-edge bar that pulls the slats across */}
      <group ref={leadRef} position={[slatX, yCover, zStart]} visible={false}>
        <mesh>
          <boxGeometry args={[slatWidth + 0.03, 0.05, 0.06]} />
          <meshStandardMaterial color={frame} roughness={0.45} metalness={0.25} />
        </mesh>
      </group>
    </group>
  );
}


/**
 * İç aydınlatma: cam olmayan her kenarın ortasında, su altında, duvara gömme yuvarlak havuz lambası
 * (beyaz çerçeve + noktalı LED camı).
 * Renk beyaz ya da RGB (RGB'de renkler arasında yavaşça döner).
 */
let poolLampLens: THREE.CanvasTexture | null = null;

/** Havuz lambası LED camı: ızgara düzeninde parlak LED noktaları, aralarında prizmatik doku. */
function getPoolLampLensTexture() {
  if (poolLampLens) return poolLampLens;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9aa3ad';
  g.fillRect(0, 0, S, S);
  const step = 9;
  for (let y = step / 2; y < S; y += step) {
    for (let x = step / 2 + ((y / step) % 2 ? step / 2 : 0); x < S; x += step) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  poolLampLens = new THREE.CanvasTexture(c);
  poolLampLens.colorSpace = THREE.SRGBColorSpace;
  return poolLampLens;
}

function PoolSideLamps({
  color,
  w,
  l,
  waterY,
  isNight,
  config,
}: {
  color: LightColor;
  w: number;
  l: number;
  waterY: number;
  isNight: boolean;
  config: PoolConfig;
}) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const animated = color === 'rgb' || color === 'blue_purple';

  useFrame((state) => {
    if (!animated) return;
    const c = animatedColor(color, state.clock.elapsedTime);
    lights.current.forEach((lt) => lt?.color.copy(c));
    mats.current.forEach((m) => m?.emissive.copy(c));
  });

  const base = lightColorHex(color);
  const y = Math.max(BASIN_FLOOR + 0.2, waterY - 0.5);
  const reach = Math.max(w, l) * 1.4;
  const halfW = w / 2;
  const halfL = l / 2;

  // Her kenarda bir lamba: kenarın ortasına en yakın kapalı panelin ortasında, duvara yaslı.
  // Tamamı cam olan kenara lamba konmaz.
  const lamps: { key: PoolSide; pos: [number, number, number]; n: [number, number] }[] = [];
  for (const side of POOL_SIDES) {
    const alongX = side === 'north' || side === 'south';
    const bounds = panelBounds(side, config, (alongX ? halfW : halfL) * 2 - FRAME_T);
    let best: number | null = null;
    bounds.forEach((bd, i) => {
      if (getPanelType(config, side, i) === 'glass') return;
      const c = (bd.start + bd.end) / 2;
      if (best === null || Math.abs(c) < Math.abs(best)) best = c;
    });
    if (best === null) continue;
    const c = best as number;
    const d = LINER + 0.002; // lamba duvar kaplamasına gömme
    const pos: [number, number, number] =
      side === 'south' ? [c, y, halfL - d]
      : side === 'north' ? [c, y, -halfL + d]
      : side === 'east' ? [halfW - d, y, c]
      : [-halfW + d, y, c];
    const n: [number, number] =
      side === 'south' ? [0, -1] : side === 'north' ? [0, 1] : side === 'east' ? [-1, 0] : [1, 0];
    lamps.push({ key: side, pos, n });
  }
  const R = 0.14; // çerçeve dış yarıçapı (≈28 cm)
  const lens = useMemo(getPoolLampLensTexture, []);
  return (
    <group>
      {lamps.map((lp, i) => (
        // Yerel +Z havuzun içine bakar
        <group key={lp.key} position={lp.pos} rotation={[0, Math.atan2(lp.n[0], lp.n[1]), 0]}>
          {/* Beyaz plastik çerçeve */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
            <cylinderGeometry args={[R, R, 0.024, 40]} />
            <meshStandardMaterial color="#f4f5f2" roughness={0.45} />
          </mesh>
          {/* Çerçevedeki vida yuvaları ve havalandırma yarıkları */}
          {[0.25, 1.85, 3.4, 5.0].map((ang, k) => (
            <mesh key={k} position={[Math.cos(ang) * R * 0.86, Math.sin(ang) * R * 0.86, 0.0245]}>
              <circleGeometry args={[k % 2 ? 0.007 : 0.006, 12]} />
              <meshBasicMaterial color="#5b6168" />
            </mesh>
          ))}
          {/* LED camı: noktalı LED dizisi */}
          <mesh position={[0, 0, 0.026]}>
            <circleGeometry args={[R * 0.68, 40]} />
            <meshStandardMaterial
              ref={(m) => { mats.current[i] = m; }}
              color="#ffffff"
              map={lens}
              emissive={base}
              emissiveMap={lens}
              emissiveIntensity={isNight ? 0.55 : 0.4}
              roughness={0.2}
            />
          </mesh>
          {/* Işık kaynağı lamba yüzünün arkasında: havuzu aydınlatır, lambanın kendisini parlatmaz */}
          <pointLight
            ref={(el) => { lights.current[i] = el; }}
            position={[0, 0, 0.005]}
            color={base}
            intensity={isNight ? 1.6 : 1}
            distance={reach}
            decay={1}
          />
        </group>
      ))}
    </group>
  );
}

// ─── Dış aydınlatma ──────────────────────────────────────────────────────────

const OUTDOOR_LIGHT = '#ffe6c2'; // sıcak beyaz

/**
 * Dış şerit LED: havuz gövdesinin, makine dairesinin ve terasların dış çevresi boyunca, kenar
 * döşemesinin hemen altında kesintisiz, iç şerit LED gibi tek çizgi.
 */
function OuterStripLed({
  runs,
  top,
  groundY,
  isNight,
}: {
  runs: StripRun[];
  top: number;
  groundY: number;
  isNight: boolean;
}) {
  const y = top - COPING_T - 0.02;
  return (
    <group>
      {runs.map((r, i) => {
        const dx = r.to[0] - r.from[0];
        const dz = r.to[1] - r.from[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.05) return null;
        const cx = (r.from[0] + r.to[0]) / 2 + r.n[0] * r.off;
        const cz = (r.from[1] + r.to[1]) / 2 + r.n[1] * r.off;
        // Yerel +Z dışa (normal yönüne) baksın
        const rotY = Math.atan2(r.n[0], r.n[1]);
        return (
          <group key={i} position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
            <mesh position={[0, y, 0]}>
              <boxGeometry args={[len, 0.02, 0.015]} />
              <meshStandardMaterial color={OUTDOOR_LIGHT} emissive={OUTDOOR_LIGHT} emissiveIntensity={isNight ? 3 : 0.6} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── Kenar terasları ─────────────────────────────────────────────────────────

type ExtDeck = { side: PoolSide; rect: DeckRect };
type ExtCorner = { ns: PoolSide; ew: PoolSide; rect: DeckRect };

/** Terasın yerel çerçevesi: +Z havuza bakar, X teras boyunca uzanır. */
const DECK_ROT: Record<PoolSide, number> = {
  north: 0,
  south: Math.PI,
  east: -Math.PI / 2,
  west: Math.PI / 2,
};

type EdgeRun = { from: [number, number]; to: [number, number]; n: [number, number] };

/**
 * Terasların ve köşe parçalarının açıkta kalan dış kenarları (dışa bakan normalleriyle):
 * terasın dış kenarı, köşe parçasına bağlanmayan uçları ve köşe parçalarının iki dış kenarı.
 */
function deckOuterEdges(decks: ExtDeck[], corners: ExtCorner[]): EdgeRun[] {
  const hasCorner = (ns: PoolSide, ew: PoolSide) => corners.some((c) => c.ns === ns && c.ew === ew);
  const runs: EdgeRun[] = [];
  for (const { side, rect: r } of decks) {
    if (side === 'east' || side === 'west') {
      const sx = side === 'east' ? 1 : -1;
      const ox = side === 'east' ? r.x2 : r.x1;
      runs.push({ from: [ox, r.z1], to: [ox, r.z2], n: [sx, 0] });
      if (!hasCorner('north', side)) runs.push({ from: [r.x1, r.z1], to: [r.x2, r.z1], n: [0, -1] });
      if (!hasCorner('south', side)) runs.push({ from: [r.x1, r.z2], to: [r.x2, r.z2], n: [0, 1] });
    } else {
      const sz = side === 'south' ? 1 : -1;
      const oz = side === 'south' ? r.z2 : r.z1;
      runs.push({ from: [r.x1, oz], to: [r.x2, oz], n: [0, sz] });
      if (!hasCorner(side, 'west')) runs.push({ from: [r.x1, r.z1], to: [r.x1, r.z2], n: [-1, 0] });
      if (!hasCorner(side, 'east')) runs.push({ from: [r.x2, r.z1], to: [r.x2, r.z2], n: [1, 0] });
    }
  }
  for (const { ns, ew, rect: r } of corners) {
    const ox = ew === 'east' ? r.x2 : r.x1;
    const oz = ns === 'south' ? r.z2 : r.z1;
    runs.push({ from: [ox, r.z1], to: [ox, r.z2], n: [ew === 'east' ? 1 : -1, 0] });
    runs.push({ from: [r.x1, oz], to: [r.x2, oz], n: [0, ns === 'south' ? 1 : -1] });
  }
  return runs;
}

type StripRun = EdgeRun & {
  /** Kenardan dışarı uzaklık (negatif: döşeme altında, kenarın içinde) */
  off: number;
};

/**
 * Dış şerit LED'in izlediği kenarlar: havuzun, makine dairesinin ve platformun dış çevresi
 * (uzatmada platform döşemesinin dış kenarı), teras eklenmiş kenarlarda terasın dış kenarı.
 * Platformun yönünden bağımsız olsun diye hesap, platformun +u yönünde olduğu yerel çerçevede yapılır.
 */
function stripLedRuns(config: PoolConfig, decks: ExtDeck[], corners: ExtCorner[]): StripRun[] {
  const dir = config.platformDirection;
  const alongX = dir === 'east' || dir === 'west';
  const hu = (alongX ? config.width : config.length) / 2;  // havuzun platforma dik yarı boyu
  const hv = (alongX ? config.length : config.width) / 2;  // platform boyunca yarı boy
  const gap = COPING_W - FRAME_T;
  const cab = hu + gap + PLATFORM_DEPTH * 0.6;             // makine dairesi dış yüzü
  const plat = hu + gap + PLATFORM_DEPTH * (config.platformExtension ? 1 : 0.6); // platform dış kenarı
  const BODY = FRAME_T / 2 + 0.02;  // havuz duvarı: kolonların önü
  const CAB = 0.015;                 // makine dairesi yüzü
  const DECK = -0.025;               // döşeme altı

  // Yerel (u, v) → havuz (x, z)
  const toXZ = (u: number, v: number): [number, number] =>
    dir === 'east' ? [u, v] : dir === 'west' ? [-u, v] : dir === 'north' ? [v, -u] : [v, u];
  const OPP: Record<PoolSide, PoolSide> = { north: 'south', south: 'north', east: 'west', west: 'east' };
  // Yerel −v / +v kenarlarının dünya karşılığı
  const sideOfV = (sv: number): PoolSide => {
    const [x, z] = toXZ(0, sv);
    return Math.abs(x) > Math.abs(z) ? (x > 0 ? 'east' : 'west') : z > 0 ? 'south' : 'north';
  };
  const hasDeck = (sd: PoolSide) => decks.some((d) => d.side === sd);
  const hasCornerWith = (sd: PoolSide, other: PoolSide) =>
    corners.some((c) => (c.ns === sd && c.ew === other) || (c.ew === sd && c.ns === other));

  const runs: StripRun[] = [];
  const add = (u1: number, v1: number, u2: number, v2: number, nu: number, nv: number, off: number) => {
    const [nx, nz] = toXZ(nu, nv);
    runs.push({ from: toXZ(u1, v1), to: toXZ(u2, v2), n: [nx, nz], off });
  };

  // Arka kenar (makine dairesinin karşısı)
  if (!hasDeck(OPP[dir])) add(-hu, -hv, -hu, hv, -1, 0, BODY);
  // Platformun dış kenarı: uzatmada konsol döşemenin altı, değilse makine dairesi yüzü
  const he = hv + PLATFORM_END_EXT;
  if (config.platformExtension) add(plat, -he, plat, he, 1, 0, DECK);
  else add(cab, -he, cab, he, 1, 0, CAB);
  // Yan kenarlar: havuz duvarı + makine dairesi (+ uzatmada konsol kısım)
  for (const sv of [-1, 1]) {
    const side = sideOfV(sv);
    const v = sv * hv;
    if (!hasDeck(side)) add(-hu, v, hu, v, 0, sv, BODY);
    if (hasDeck(side) && hasCornerWith(side, dir)) continue; // köşe parçası kapatır
    const ve = sv * (hv + PLATFORM_END_EXT); // platform ucu (kenar döşemesi hizası)
    add(hu, ve, cab, ve, 0, sv, CAB);
    if (config.platformExtension) add(cab, ve, plat, ve, 0, sv, DECK);
  }
  for (const r of deckOuterEdges(decks, corners)) runs.push({ ...r, off: DECK });
  return runs;
}

function ExtensionDecks({
  decks,
  corners,
  top,
  frameColor,
  railings,
}: {
  decks: ExtDeck[];
  corners: ExtCorner[];
  top: number;
  frameColor: string;
  railings: boolean;
}) {
  const deckT = 0.1;
  // Korkuluklar: terasların dış kenarı, köşe parçasına bağlanmayan uçlar ve köşe parçalarının dış kenarları
  const runs = railings ? deckOuterEdges(decks, corners) : [];

  return (
    <group>
      {decks.map(({ side, rect: r }) => {
        const alongZ = side === 'east' || side === 'west';
        const len = alongZ ? r.z2 - r.z1 : r.x2 - r.x1;
        const depth = alongZ ? r.x2 - r.x1 : r.z2 - r.z1;
        return (
          <group key={side}>
            <DeckSlab rect={r} top={top} deckT={deckT} />
            <group position={[(r.x1 + r.x2) / 2, top, (r.z1 + r.z2) / 2]} rotation={[0, DECK_ROT[side], 0]}>
              <DeckDecor len={len} depth={depth} />
            </group>
          </group>
        );
      })}
      {corners.map(({ ns, ew, rect: r }) => (
        <group key={`${ns}-${ew}`}>
          <DeckSlab rect={r} top={top} deckT={deckT} />
          {/* Köşede saksı */}
          <Planter
            position={[
              ew === 'east' ? r.x2 - 0.4 : r.x1 + 0.4,
              top,
              ns === 'south' ? r.z2 - 0.4 : r.z1 + 0.4,
            ]}
          />
        </group>
      ))}
      {runs.length > 0 && (
        <group position={[0, top, 0]}>
          {runs.map((run, i) => (
            <RailingRun key={i} from={run.from} to={run.to} height={1.05} spacing={1.2} color={frameColor} postR={0.025} />
          ))}
        </group>
      )}
    </group>
  );
}

/** Teras döşemesi (platform yüzeyi); altı boş, ayak ya da gövde yok. */
function DeckSlab({ rect: r, top, deckT }: { rect: DeckRect; top: number; deckT: number }) {
  return (
    <Beam
      args={[r.x2 - r.x1, deckT, r.z2 - r.z1]}
      radius={0.01}
      position={[(r.x1 + r.x2) / 2, top - deckT / 2, (r.z1 + r.z2) / 2]}
      castShadow
      receiveShadow
    >
      <DeckSurfaceMaterial />
    </Beam>
  );
}

/**
 * Teras dekoru (yerel çerçeve: +Z havuz tarafı, X teras boyunca, y=0 döşeme üstü).
 * Şezlong sayısı teras uzunluğuna göre artar: kısa terasta 2, uzunda 4, çok uzunda 6 şezlong
 * (her çift arasında sehpa ve şemsiye). Yer kalırsa masa-sandalye takımı ve uçlara saksı eklenir.
 * 2,5 m'den kısa terasta yalnızca şemsiyeli masa takımı.
 */
function DeckDecor({ len, depth }: { len: number; depth: number }) {
  const halfLen = len / 2;
  const back = -depth / 2 + 0.4; // havuzdan uzak taraf
  const d = 0.14;
  const PAIR_W = 2.4;   // iki şezlong + sehpa
  const DINING_W = 1.9; // masa + 4 sandalye

  if (len < 2.5) {
    return <DiningSet position={[0, 0, 0]} chairs={len >= 2.4 ? 4 : 2} parasol />;
  }

  const pairs = len < 4.6 ? 1 : len < 7.6 ? 2 : 3;
  const spare = len - pairs * PAIR_W;
  const dining = len >= 5 && spare >= DINING_W + 0.9;
  const groups: ('pair' | 'dining')[] = Array(pairs).fill('pair');
  if (dining) groups.splice(Math.ceil(pairs / 2), 0, 'dining');
  const used = pairs * PAIR_W + (dining ? DINING_W : 0);
  const gap = (len - used) / (groups.length + 1);

  let x = -halfLen + gap;
  const items = groups.map((g, i) => {
    const w = g === 'pair' ? PAIR_W : DINING_W;
    const cx = x + w / 2;
    x += w + gap;
    return g === 'pair' ? (
      <group key={i} position={[cx, 0, -0.2]}>
        <LoungeChair position={[-0.85, 0, 0]} rotY={d} />
        <SideTable position={[0, 0, 0.1]} />
        <LoungeChair position={[0.85, 0, 0]} rotY={-d} />
        <Parasol position={[0, 0, -0.6]} />
      </group>
    ) : (
      <DiningSet key={i} position={[cx, 0, 0]} chairs={4} />
    );
  });

  return (
    <group>
      {items}
      {gap >= 0.55 && <Planter position={[-halfLen + 0.3, 0, back]} />}
      {gap >= 0.55 && <Planter position={[halfLen - 0.3, 0, back]} />}
    </group>
  );
}

/** Yuvarlak bahçe masası + sandalyeler; isteğe bağlı orta şemsiye. */
function DiningSet({
  position,
  chairs = 4,
  parasol = false,
}: {
  position: [number, number, number];
  chairs?: 2 | 4;
  parasol?: boolean;
}) {
  const metal = '#3a3d42';
  const r = 0.66;
  // Sandalyeler masanın çevresinde; 2 sandalyede X ekseninde karşılıklı
  const spots: [number, number][] = chairs === 4
    ? [[-r, 0], [r, 0], [0, -r], [0, r]]
    : [[-r, 0], [r, 0]];
  return (
    <group position={position}>
      {/* Masa: tek ayak + ahşap tabla */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.03, 20]} />
        <meshStandardMaterial color={metal} metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.37, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
        <meshStandardMaterial color={metal} metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.035, 32]} />
        <meshStandardMaterial color="#b8742a" roughness={0.6} />
      </mesh>
      <WineGlass position={[-0.12, 0.775, 0.08]} />
      <WineGlass position={[0.12, 0.775, -0.08]} />
      {spots.map(([x, z], i) => (
        <DiningChair key={i} position={[x, 0, z]} rotY={Math.atan2(-x, -z)} />
      ))}
      {parasol && <Parasol position={[0, 0, 0]} />}
    </group>
  );
}

/** Bahçe sandalyesi: oturan kişi yerel +Z yönüne bakar. */
function DiningChair({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  const metal = '#3a3d42';
  const seat = '#e9e4da';
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.04, 0.42]} />
        <meshStandardMaterial color={seat} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.72, -0.2]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.44, 0.42, 0.03]} />
        <meshStandardMaterial color={seat} roughness={0.85} />
      </mesh>
      {([[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.215, z]} castShadow>
          <boxGeometry args={[0.03, 0.43, 0.03]} />
          <meshStandardMaterial color={metal} metalness={0.5} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

/** Bahçe şemsiyesi: ağırlık tabanı, direk ve sekizgen kumaş. */
function Parasol({ position }: { position: [number, number, number] }) {
  const pole = '#d9d6cf';
  const fabric = '#efe9dc';
  const h = 2.25;
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.24, 0.06, 20]} />
        <meshStandardMaterial color="#5b5e63" roughness={0.7} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, h, 10]} />
        <meshStandardMaterial color={pole} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, h - 0.12, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.15, 0.38, 8, 1, true]} />
        <meshStandardMaterial color={fabric} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h + 0.1, 0]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial color={pole} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Antrasit saksı + yuvarlak çalı. */
function Planter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Beam args={[0.42, 0.5, 0.42]} radius={0.015} position={[0, 0.25, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2f3236" roughness={0.75} />
      </Beam>
      <mesh position={[0, 0.72, 0]} scale={[1, 0.9, 1]} castShadow>
        <sphereGeometry args={[0.3, 20, 16]} />
        <meshStandardMaterial color="#3f6b35" roughness={0.95} />
      </mesh>
      <mesh position={[0.1, 0.9, -0.05]} castShadow>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial color="#4b7d3f" roughness={0.95} />
      </mesh>
    </group>
  );
}

function groundColor(g: GroundType, isNight = false): string {
  const day: Record<GroundType, string> = {
    gravel:   '#9e9a8e',
    wood:     '#b87c3a',
    grass:    '#4a8c3f',
    concrete: '#c8c8c4',
  };
  const night: Record<GroundType, string> = {
    gravel:   '#4a4840',
    wood:     '#4a2e12',
    grass:    '#1a3a18',
    concrete: '#484a4e',
  };
  return (isNight ? night : day)[g];
}

function claddingColor(c: CladdingType): string {
  switch (c) {
    case 'white':      return '#f1f5f9';
    case 'blue_mosaic':return '#2563eb';
    case 'gray_stone': return '#6b7280';
    case 'turquoise':  return '#14b8a6';
    default:           return c.startsWith('#') ? c : '#cfd5dc'; // palet hex rengi; doku yolunda renk kullanılmaz
  }
}

/* ─── Modül-seviyesi texture cache + deduplication ─────────────────
   claddingTextureCache : tamamlanmış THREE.Texture nesneleri
   claddingLoadInFlight : devam eden Promise'lar — aynı URL için
                          ikinci istek yeni download başlatmaz       */
const claddingTextureCache  = new Map<string, THREE.Texture>();
const claddingLoadInFlight  = new Map<string, Promise<THREE.Texture | null>>();

const CLADDING_TILE = 0.6; // 60 cm per tile repeat unit

function prepareTexture(t: THREE.Texture): THREE.Texture {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* Yüzey boyutuna göre texture'ı klonlayıp doğru repeat'i set eden bileşen.
   clone() aynı GPU texture'ı paylaşır — sadece JS Texture nesnesi yeni oluşur. */
/** Derz rengi: karo renginin bu oranı (derzler her yüzeyde aynı netlikte görünsün) */
const GROUT_SHADE = 0.5;
/** Kaplamanın genel parlaklığı: açık renkler (beyaz) tam ışıkta patlamasın, derzler görünsün */
const CLADDING_EXPOSURE = 0.8;
/** Duvarların tabana göre sabit tonu: derinlik okunsun, güneş açısından bağımsız */
const WALL_SHADE = 0.84;
/** Köşe gölgesi: birleşim çizgisinde koyulaşma oranı ve yayılma mesafesi (m) */
const SEAM_AO = 0.38;
const SEAM_AO_DIST = 0.28;

/**
 * Havuz iç kaplaması. Taban ve duvarlar aynı malzemedir, ama dikey yüzeyler güneşe farklı
 * açılarla baktığından her biri farklı tonda görünüyordu. Bunu önlemek için ışık hesabında
 * yüzey normali her yüzeyde yukarı (taban normali) kabul edilir: hangi yöne bakarsa baksın
 * her kaplama yüzeyi tabanla aynı rengi alır. Derzler ışıktan bağımsız olarak renge işlenir.
 */
function CladdingMat({
  tex,
  color,
  sw,
  sh,
  roughness = 0.85,
  metalness = 0,
  envMapIntensity = 0,
  side,
  surface = 'flat',
  corners = [false, false],
}: {
  tex: THREE.Texture | null;
  color: string;
  sw: number; // yüzey genişliği (metre)
  sh: number; // yüzey yüksekliği (metre)
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  side?: THREE.Side;
  /**
   * 'floor': taban — dört kenarında duvar birleşimi gölgesi.
   * 'wall': duvar — tabandan koyu sabit ton + alt kenarda gölge (+ `corners` ile dikey köşelerde).
   * 'wallTone': yalnız duvar tonu (kenar bandı, cam çevresi şeritleri).
   * 'flat': yalnız pozlama (basamak, kapak vb.).
   */
  surface?: 'floor' | 'wall' | 'wallTone' | 'flat';
  /** 'wall' için: yüzeyin u=0 / u=1 kenarı gerçek bir köşe mi (panel birleşimi değil) */
  corners?: [boolean, boolean];
}) {
  const [tileW, tileH]: [number, number] = tex?.userData.tileM ?? [CLADDING_TILE, CLADDING_TILE];
  const repeatX = Math.max(1, Math.round(sw / tileW));
  const repeatY = Math.max(1, Math.round(sh / tileH));

  const mask = useMemo(() => {
    const m = getTileMaps().mask.clone();
    m.repeat.set(repeatX, repeatY);
    m.needsUpdate = true;
    return m;
  }, [repeatX, repeatY]);

  useEffect(() => () => { mask.dispose(); }, [mask]);

  const scaled = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
    return t;
  }, [tex, repeatX, repeatY]);

  useEffect(() => () => { scaled?.dispose(); }, [scaled]);

  // Derz maskesi alphaMap UV'siyle örneklenir (alphaMap'in kendisi kullanılmaz, yalnızca UV
  // dönüşümü için verilir). Işık için normal, görünüm uzayında "yukarı" yapılır.
  const mode = surface === 'floor' ? 1 : surface === 'wall' ? 2 : surface === 'wallTone' ? 3 : 0;
  const [cornerA, cornerB] = corners;
  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRepeat = { value: new THREE.Vector2(repeatX, repeatY) };
    shader.uniforms.uSize = { value: new THREE.Vector2(sw, sh) };
    shader.uniforms.uCorner = { value: new THREE.Vector2(cornerA ? 1 : 0, cornerB ? 1 : 0) };
    const tone = mode === 2 || mode === 3 ? ` * ${WALL_SHADE.toFixed(2)}` : '';
    const edge =
      mode === 1 ? 'float dEdge = min(min(m.x, uSize.x - m.x), min(m.y, uSize.y - m.y));'
      : mode === 2 ? `float dEdge = min(m.y, 1.6 * min(uCorner.x > 0.5 ? m.x : 1e3, uCorner.y > 0.5 ? uSize.x - m.x : 1e3));`
      : '';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uRepeat;\nuniform vec2 uSize;\nuniform vec2 uCorner;')
      .replace(
        '#include <alphamap_fragment>',
        `float groutF = mix(${GROUT_SHADE.toFixed(2)}, 1.0, texture2D(alphaMap, vAlphaMapUv).r);
        diffuseColor.rgb *= groutF * ${CLADDING_EXPOSURE.toFixed(2)}${tone};
        // Yüzey üzerindeki konum (metre): köşe/birleşim gölgesi
        vec2 m = (vAlphaMapUv / uRepeat) * uSize;
        ${edge}
        ${edge ? `diffuseColor.rgb *= 1.0 - ${SEAM_AO.toFixed(2)} * exp(-dEdge / ${SEAM_AO_DIST.toFixed(2)});` : ''}`,
      )
      .replace(
        '#include <aomap_fragment>',
        `reflectedLight.directSpecular = vec3(0.0);
        reflectedLight.indirectSpecular = vec3(0.0);
        #include <aomap_fragment>`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`,
      );
  }, [repeatX, repeatY, sw, sh, mode, cornerA, cornerB]);

  return (
    <meshStandardMaterial
      key={`${scaled?.uuid ?? `no-tex-${sw}-${sh}`}-${mask.uuid}-${mode}-${cornerA}-${cornerB}`}
      color={tex ? '#ffffff' : color}
      map={scaled ?? undefined}
      alphaMap={mask}
      roughness={roughness}
      metalness={metalness}
      envMapIntensity={envMapIntensity}
      side={side}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={() => `cladding-v4-${mode}`}
    />
  );
}

/* Tek bir yükleme fonksiyonu — hem preloader hem hook bunu kullanır.
   Aynı URL iki kez çağrılırsa tek download yapılır. */
function loadCladdingUrl(url: string): Promise<THREE.Texture | null> {
  const hit = claddingTextureCache.get(url);
  if (hit) return Promise.resolve(hit);

  const inflight = claddingLoadInFlight.get(url);
  if (inflight) return inflight;

  const p = new Promise<THREE.Texture | null>((resolve) => {
    new THREE.TextureLoader().load(
      claddingSceneUrl(url),
      (t) => {
        prepareTexture(t);
        t.anisotropy = 8;
        t.userData.tileM = claddingTileSize(url);
        claddingTextureCache.set(url, t);
        claddingLoadInFlight.delete(url);
        resolve(t);
      },
      undefined,
      () => { claddingLoadInFlight.delete(url); resolve(null); },
    );
  });
  claddingLoadInFlight.set(url, p);
  return p;
}

/* Arka plan preloader — max 3 eşzamanlı indirme, 2sn gecikmeyle başlar.
   27 isteği aynı anda göndermek mobil tarayıcıları ve dev sunucuyu çökertebilir. */
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const queue = [...CLADDING_TEXTURE_URLS];
    const CONCURRENT = typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 3;
    const worker = async () => {
      for (let url; (url = queue.shift());) await loadCladdingUrl(url);
    };
    Array.from({ length: CONCURRENT }, worker);
  }, 2000);
}

function useCladdingTexture(cladding: CladdingType): THREE.Texture | null {
  const invalidate = useThree((s) => s.invalidate);

  /* Önbellekte varsa senkron başlat — gecikmesiz */
  const [tex, setTex] = useState<THREE.Texture | null>(() =>
    claddingTextureCache.get(cladding) ?? null
  );

  /* tex state commit'inden SONRA sahneyi yeniden çiz.
     setTex + invalidate() aynı anda çağrılınca R3F frame'i React commit'inden
     önce ateşlenip eski material ile çizebiliyor; bu effect bu race'i önler. */
  useEffect(() => {
    invalidate();
  }, [tex, invalidate]);

  useEffect(() => {
    const cached = claddingTextureCache.get(cladding);
    if (cached) { setTex(cached); return; }

    const isPath   = cladding.startsWith('/textures/');
    const isLegacy = /^texture\d$/.test(cladding);
    if (!isPath && !isLegacy) { setTex(null); return; }

    let cancelled = false;

    if (isPath) {
      /* Paylaşımlı yükleyici: preloader zaten indiriyorsa aynı Promise'a bağlanır */
      loadCladdingUrl(cladding).then(t => {
        if (!cancelled) { setTex(t); }
      });
      return () => { cancelled = true; };
    }

    // Legacy texture1…texture5
    const loader = new THREE.TextureLoader();
    const tryLoad = (ext: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(`/textures/${cladding}.${ext}`, resolve, undefined, reject);
      });

    (async () => {
      let loaded: THREE.Texture | null = null;
      for (const ext of ['jpeg', 'jpg', 'png']) {
        try { loaded = await tryLoad(ext); break; } catch { /* dene */ }
      }
      if (!cancelled) {
        if (loaded) { prepareTexture(loaded); claddingTextureCache.set(cladding, loaded); setTex(loaded); }
        else { setTex(null); }
      }
    })();

    return () => { cancelled = true; };
  }, [cladding, invalidate]);

  return tex;
}

function frameColorHex(c: FrameColor): string {
  switch (c) {
    case 'anthracite': return '#3a3f45';
    case 'blue': return '#2da6d2';
    case 'white': return '#e5e7eb';
  }
}

function animatedColor(color: LightColor, t: number): THREE.Color {
  if (color === 'rgb') return new THREE.Color().setHSL((t * 0.08) % 1, 0.9, 0.45);
  if (color === 'blue_purple') {
    return new THREE.Color().setHSL(0.61 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 0.17, 1.0, 0.48);
  }
  return new THREE.Color(lightColorHex(color));
}

function lightColorHex(c: LightColor): string {
  switch (c) {
    case 'blue':        return '#3b82f6';
    case 'white':       return '#ffffff';
    case 'warm_white':  return '#fde68a';
    case 'green':       return '#22c55e';
    case 'cyan':        return '#06b6d4';
    case 'turquoise':   return '#14b8a6';
    case 'red':         return '#ef4444';
    case 'orange':      return '#f97316';
    case 'pink':        return '#ec4899';
    case 'purple':      return '#a855f7';
    case 'rgb':         return '#ff3b3b';
    case 'blue_purple': return '#6a3cf7';
  }
}
