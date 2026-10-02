'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  OrbitControls,
  Sky,
  Stars,
} from '@react-three/drei';
import { EffectComposer, Bloom, SMAA, Vignette, SSAO } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  getPanelType,
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
import { Beam, GlassMaterial, PowderCoatMaterial, WoodMaterial, getSolarTexture, getTileMaps, groundAntiTile, groundAntiTileKey } from './materials';

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
const BASIN_FLOOR = 0.06;
const PLATFORM_DEPTH = 2.0;

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
    const fp = poolFootprint(config);
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
  }, [config.width, config.length, config.platformDirection, config.installation, config.liftDeck]);
}

interface CameraRigProps {
  preset: CamPreset | null;
  onTransitionEnd: () => void;
  orbitControlsRef: React.MutableRefObject<any>;
  isMobile: boolean;
  presets: Record<CamPreset, CamView>;
  orbit: { radius: number; height: number; target: THREE.Vector3 };
}

function CameraRig({ preset, onTransitionEnd, orbitControlsRef, isMobile, presets, orbit }: CameraRigProps) {
  const { camera, invalidate } = useThree();
  const targetPos  = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const animating  = useRef(false);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdle     = useRef(false);
  const orbitAngle = useRef(0);
  const idleMs     = useRef(isMobile ? 5000 : 3000);
  useEffect(() => { idleMs.current = isMobile ? 5000 : 3000; }, [isMobile]);

  // Idle detection — reset timer on any pointer/touch activity
  useEffect(() => {
    const resetIdle = () => {
      isIdle.current = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => { isIdle.current = true; }, idleMs.current);
      invalidate();
    };
    window.addEventListener('pointermove', resetIdle, { passive: true });
    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('touchstart',  resetIdle, { passive: true });
    window.addEventListener('touchend',    resetIdle, { passive: true });
    resetIdle();
    return () => {
      window.removeEventListener('pointermove', resetIdle);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('touchstart',  resetIdle);
      window.removeEventListener('touchend',    resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [invalidate]);

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

    // ── Auto-orbit when idle ──────────────────────────────────────────────
    if (isIdle.current && !animating.current) {
      orbitAngle.current += 0.003;
      const x = orbit.target.x + Math.sin(orbitAngle.current) * orbit.radius;
      const z = orbit.target.z + Math.cos(orbitAngle.current) * orbit.radius;
      camera.position.set(x, orbit.height, z);
      camera.lookAt(orbit.target);
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.copy(orbit.target);
        orbitControlsRef.current.update();
      }
      invalidate();
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
function EnableAllShadows({ config }: { config: PoolConfig }) {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    invalidate();
  }, [config, scene, invalidate]);
  return null;
}

export default function PoolScene({
  config,
  controlsRef,
}: {
  config: PoolConfig;
  controlsRef?: React.MutableRefObject<{ reset: () => void } | null>;
}) {
  const isNight = config.lighting.enabled;
  const isMobile = useIsMobile();
  const [activePreset, setActivePreset] = useState<CamPreset | null>('close');
  const framing = useCameraFraming(config);
  const internalControlsRef = useRef<any>(null);
  const orbitRef = (controlsRef ?? internalControlsRef) as React.MutableRefObject<any>;

  const handlePreset = useCallback((p: CamPreset) => { setActivePreset(p); }, []);
  const handleTransitionEnd = useCallback(() => { /* preset stays highlighted */ }, []);
  const shadowMapSize = isMobile ? 1024 : 4096;
  const gardenHole = sinkDepth(config) > 0 ? poolFootprint(config) : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <CameraButtons active={activePreset} onSelect={handlePreset} isMobile={isMobile} />
      <Canvas
      frameloop="demand"
      shadows
      camera={{ position: [12, 7.5, 20], fov: 50 }}
      dpr={isMobile ? [1, 1] : [1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
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
              castShadow
              shadow-mapSize-width={shadowMapSize}
              shadow-mapSize-height={shadowMapSize}
              shadow-bias={-0.0004}
              shadow-camera-near={0.5}
              shadow-camera-far={100}
              shadow-camera-left={-28}
              shadow-camera-right={28}
              shadow-camera-top={28}
              shadow-camera-bottom={-28}
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
              castShadow
              shadow-mapSize-width={shadowMapSize}
              shadow-mapSize-height={shadowMapSize}
              shadow-bias={-0.0004}
              shadow-camera-near={0.5}
              shadow-camera-far={100}
              shadow-camera-left={-28}
              shadow-camera-right={28}
              shadow-camera-top={28}
              shadow-camera-bottom={-28}
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
          isMobile={isMobile}
          presets={framing.presets}
          orbit={framing.orbit}
        />
        {/* Enable shadows on ALL scene objects automatically */}
        <EnableAllShadows config={config} />
        {/* Invalidate on config change so demand-rendering stays in sync */}
        <ConfigInvalidator config={config} />
        {/* Cap animated rendering to ~30fps while water/lighting animate */}
        <AnimationTicker active={config.showWater || config.lighting.enabled} />

        {/* Post-processing — disabled on mobile for performance */}
        {!isMobile && (
          <EffectComposer multisampling={0} enableNormalPass>
            <SSAO
              blendFunction={BlendFunction.MULTIPLY}
              samples={16}
              rings={3}
              luminanceInfluence={0.7}
              radius={0.05}
              bias={0.025}
              intensity={isNight ? 2.5 : 1.2}
              worldDistanceThreshold={1.0}
              worldDistanceFalloff={0.1}
              worldProximityThreshold={0.3}
              worldProximityFalloff={0.02}
            />
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
  /** Havuz + makine dairesi izdüşümü; döşeme bunun her yanına `margin` kadar taşar */
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
  const localHole = useMemo(
    () => (hole ? { minX: hole.minX - cx, maxX: hole.maxX - cx, minZ: hole.minZ - cz, maxZ: hole.maxZ - cz } : null),
    [hole, cx, cz],
  );
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

  return (
    <group>
      {/* Deck platform — çimen seçiliyken gizle, diğer zemin tiplerinde göster */}
      {(config.ground !== 'grass' || groundPatch !== 'auto') && (
        <PoolDeck footprint={poolFootprint(config)} ground={config.ground} isNight={isNight} hole={hole} soft={groundPatch === 'plinth'} margin={groundPatch === 'kerb' ? 1.2 : 2.5} />
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
        <planeGeometry args={[w - PANEL_T * 2 - 0.02, l - PANEL_T * 2 - 0.02]} />
        <CladdingMat
          tex={claddingTex}
          color={inner}
          sw={w - PANEL_T * 2 - 0.02}
          sh={l - PANEL_T * 2 - 0.02}
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

      {/* Inner wall cladding strip visible above the waterline */}
      <InnerRim w={w} l={l} waterY={waterY} top={top} color={inner} claddingTex={claddingTex} />

      {/* Side panels — one mesh per (side, segment) so each can be glass/closed */}
      <SidePanels
        halfW={halfW}
        halfL={halfL}
        top={top}
        config={config}
        frame={frame}
        claddingTex={claddingTex}
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
      <Coping w={w} l={l} y={top} />

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

      {/* Pool lighting — three-layer glow with optional RGB animation */}
      {config.lighting.enabled && (
        <PoolLighting
          color={config.lighting.color}
          w={w}
          l={l}
          waterY={waterY}
        />
      )}

      {/* LED accent strips — top + bottom perimeter inside the pool */}
      {config.lighting.enabled && (
        <LedStrips color={config.lighting.color} w={w} l={l} top={top} />
      )}

      {/* Stainless steel waterfall feature (optional) */}
      {config.waterfall && !deckDown && <Waterfall halfL={halfL} top={top} />}

      {/* Hareketli güverte: köşe kolonlarında yukarı/aşağı */}
      {config.liftDeck && (
        <LiftDeck w={w} l={l} top={top} groundY={sink} frame={frame} up={!deckDown} isNight={isNight} solar={config.liftDeckSolar} />
      )}

      {/* Automatic slatted roller cover (optional) — slides closed when enabled */}
      {config.poolCover && (
        <PoolCover
          w={w}
          l={l}
          top={top}
          waterY={waterY}
          frame={frame}
          direction={config.platformDirection}
          closed={config.poolCoverClosed}
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
        />
      )}

      {/* Side platform + stairs + railings */}
      <Platform
        halfW={halfW}
        halfL={halfL}
        top={top}
        direction={config.platformDirection}
        frameColor={frame}
        showStairs
        showRailings={config.railings && config.installation !== 'sunken'}
        extended={config.platformExtension}
        groundY={sink}
        blockStairs={config.stairStyle === 'block'}
      />
      </group>
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
  const segsX = boundsX.length;
  const segsZ = boundsZ.length;

  const hasGlass = (side: PoolSide, segs: number) =>
    Array.from({ length: segs }, (_, i) => i).some(
      (i) => getPanelType(config, side, i) === 'glass'
    );

  const southHasGlass = hasGlass('south', segsX);
  const northHasGlass = hasGlass('north', segsX);
  const eastHasGlass  = hasGlass('east',  segsZ);
  const westHasGlass  = hasGlass('west',  segsZ);

  // Dikmeler panel birleşim noktalarında
  const offsetsX = boundsX.slice(0, -1).map((b) => b.end);
  const offsetsZ = boundsZ.slice(0, -1).map((b) => b.end);

  return (
    <group>
      {/* Mullions on +Z (south) and -Z (north) walls */}
      {offsetsX.map((x, i) => (
        <group key={`x${i}`}>
          {southHasGlass && (
            <Beam args={[mullionT, panelHeight, mullionD]} position={[x, yMid, halfL - mullionD / 2]} castShadow>
              <PowderCoatMaterial color={color} />
            </Beam>
          )}
          {northHasGlass && (
            <Beam args={[mullionT, panelHeight, mullionD]} position={[x, yMid, -halfL + mullionD / 2]} castShadow>
              <PowderCoatMaterial color={color} />
            </Beam>
          )}
        </group>
      ))}
      {/* Mullions on +X (east) and -X (west) walls */}
      {offsetsZ.map((z, i) => (
        <group key={`z${i}`}>
          {eastHasGlass && (
            <Beam args={[mullionD, panelHeight, mullionT]} position={[halfW - mullionD / 2, yMid, z]} castShadow>
              <PowderCoatMaterial color={color} />
            </Beam>
          )}
          {westHasGlass && (
            <Beam args={[mullionD, panelHeight, mullionT]} position={[-halfW + mullionD / 2, yMid, z]} castShadow>
              <PowderCoatMaterial color={color} />
            </Beam>
          )}
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
  claddingTex = null,
}: {
  halfW: number;
  halfL: number;
  top: number;
  config: PoolConfig;
  frame: string;
  claddingTex?: THREE.Texture | null;
}) {
  const inner = claddingColor(config.cladding);
  const panelHeight = top - COPING_T - BASIN_FLOOR;
  const yMid = BASIN_FLOOR + panelHeight / 2;
  const innerW = halfW * 2 - FRAME_T;
  const innerL = halfL * 2 - FRAME_T;
  const segGap = 0.02;

  // axis === 'x' → wall spans X (north/south); axis === 'z' → wall spans Z (east/west)
  // innerYRot: Y-axis rotation so a +Z-facing plane faces the pool interior
  const sides: {
    name: PoolSide;
    axis: 'x' | 'z';
    wallCoord: number;
    spanInner: number;
    panelDepth: number;
    innerYRot: number;
  }[] = [
    { name: 'south', axis: 'x', wallCoord:  halfL - PANEL_T / 2, spanInner: innerW, panelDepth: PANEL_T, innerYRot: Math.PI },
    { name: 'north', axis: 'x', wallCoord: -halfL + PANEL_T / 2, spanInner: innerW, panelDepth: PANEL_T, innerYRot: 0 },
    { name: 'east',  axis: 'z', wallCoord:  halfW - PANEL_T / 2, spanInner: innerL, panelDepth: PANEL_T, innerYRot: -Math.PI / 2 },
    { name: 'west',  axis: 'z', wallCoord: -halfW + PANEL_T / 2, spanInner: innerL, panelDepth: PANEL_T, innerYRot:  Math.PI / 2 },
  ];

  return (
    <group>
      {sides.flatMap((side) => {
        const bounds = panelBounds(side.name, config, side.spanInner);
        const segments = bounds.length;
        const sign = Math.sign(side.wallCoord);
        // Inner face position: panel center ± half thickness toward pool center
        const innerCoord = side.wallCoord - sign * (PANEL_T / 2 + 0.003);

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

          const innerPos: [number, number, number] =
            side.axis === 'x'
              ? [center, yMid, innerCoord]
              : [innerCoord, yMid, center];

          return (
            <group key={`${side.name}-${i}`}>
              {/* Panel box */}
              <Beam args={args} radius={0.004} position={position} castShadow receiveShadow renderOrder={2}>
                {isGlass ? <GlassMaterial /> : <PowderCoatMaterial color={frame} roughness={0.7} metalness={0.1} />}
              </Beam>

              {/* Inner cladding face — only on closed (non-glass) panels */}
              {!isGlass && (
                <mesh
                  position={innerPos}
                  rotation={[0, side.innerYRot, 0]}
                  renderOrder={3}
                  receiveShadow
                >
                  <planeGeometry args={[sizeAlong, panelHeight]} />
                  <CladdingMat
                    tex={claddingTex}
                    color={inner}
                    sw={sizeAlong}
                    sh={panelHeight}
                    roughness={0.8}
                    metalness={0.01}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}
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
  const inset = PANEL_T + 0.005;
  const halfW = w / 2 - inset;
  const halfL = l / 2 - inset;
  return (
    <group>
      <mesh position={[0, yMid, halfL]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={w - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[0, yMid, -halfL]}>
        <planeGeometry args={[w - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={w - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[halfW, yMid, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[l - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={l - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[-halfW, yMid, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[l - inset * 2, rimHeight]} />
        <CladdingMat tex={claddingTex} color={color} sw={l - inset * 2} sh={rimHeight} roughness={0.85} metalness={0} envMapIntensity={0} side={THREE.FrontSide} />
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

function LedStrips({
  color,
  w,
  l,
  top,
}: {
  color: LightColor;
  w: number;
  l: number;
  top: number;
}) {
  const refs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state) => {
    if (color !== 'rgb' && color !== 'blue_purple') return;
    const c = animatedColor(color, state.clock.elapsedTime);
    refs.current.forEach((mesh) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(c);
      mat.color.copy(c);
    });
  });

  const baseColor = lightColorHex(color);
  const halfW = w / 2;
  const halfL = l / 2;
  const inset = PANEL_T + 0.015;
  const stripT = 0.025;
  const stripH = 0.025;
  const innerW = w - inset * 2;
  const innerL = l - inset * 2;

  // Two height bands: under the coping and at the basin floor
  const yTop = top - COPING_T - 0.05;
  const yBottom = BASIN_FLOOR + 0.06;

  const makeStrip = (
    pos: [number, number, number],
    args: [number, number, number],
    idx: number
  ) => (
    <mesh
      key={idx}
      ref={(el) => {
        refs.current[idx] = el;
      }}
      position={pos}
      renderOrder={3}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={baseColor}
        emissive={baseColor}
        emissiveIntensity={2.5}
        toneMapped={false}
      />
    </mesh>
  );

  const strips: React.ReactNode[] = [];
  let i = 0;
  // 4 strips at top band
  strips.push(
    makeStrip([0, yTop, halfL - inset], [innerW, stripH, stripT], i++),
    makeStrip([0, yTop, -halfL + inset], [innerW, stripH, stripT], i++),
    makeStrip([halfW - inset, yTop, 0], [stripT, stripH, innerL], i++),
    makeStrip([-halfW + inset, yTop, 0], [stripT, stripH, innerL], i++),
    // 4 strips at bottom band (just above the cladding floor)
    makeStrip([0, yBottom, halfL - inset], [innerW, stripH, stripT], i++),
    makeStrip([0, yBottom, -halfL + inset], [innerW, stripH, stripT], i++),
    makeStrip([halfW - inset, yBottom, 0], [stripT, stripH, innerL], i++),
    makeStrip([-halfW + inset, yBottom, 0], [stripT, stripH, innerL], i++)
  );

  return <group>{strips}</group>;
}

function PoolLighting({
  color,
  w,
  l,
  waterY,
}: {
  color: LightColor;
  w: number;
  l: number;
  waterY: number;
}) {
  const refs = useRef<Array<THREE.PointLight | null>>([null, null, null]);

  useFrame((state) => {
    if (color !== 'rgb' && color !== 'blue_purple') return;
    const c = animatedColor(color, state.clock.elapsedTime);
    refs.current.forEach((light) => {
      if (light) light.color.copy(c);
    });
  });

  const baseColor = lightColorHex(color);
  const maxDim = Math.max(w, l);

  return (
    <>
      {/* Underwater glow */}
      <pointLight
        ref={(el) => { refs.current[0] = el; }}
        position={[0, waterY - 0.3, 0]}
        color={baseColor}
        intensity={14}
        distance={maxDim * 2.6}
        decay={1.4}
      />
      {/* Halo just above the surface */}
      <pointLight
        ref={(el) => { refs.current[1] = el; }}
        position={[0, waterY + 0.4, 0]}
        color={baseColor}
        intensity={6}
        distance={maxDim * 1.8}
        decay={1.6}
      />
      {/* Outside spillover lighting up the surrounding ground */}
      <pointLight
        ref={(el) => { refs.current[2] = el; }}
        position={[0, 0.4, 0]}
        color={baseColor}
        intensity={4}
        distance={maxDim * 3}
        decay={1.8}
      />
    </>
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

function Coping({ w, l, y }: { w: number; l: number; y: number }) {
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
      <Beam args={[totalW, COPING_T, COPING_W]} radius={0.012} position={[0, 0, halfL + out / 2]} castShadow receiveShadow>
        <WoodMaterial />
      </Beam>
      {/* -Z (north) beam */}
      <Beam args={[totalW, COPING_T, COPING_W]} radius={0.012} position={[0, 0, -halfL - out / 2]} castShadow receiveShadow>
        <WoodMaterial />
      </Beam>
      {/* +X (east) beam — trimmed to fit between +Z and -Z beams */}
      <Beam args={[xBeamLength, COPING_T, COPING_W]} radius={0.012} position={[halfW + out / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <WoodMaterial />
      </Beam>
      {/* -X (west) beam */}
      <Beam args={[xBeamLength, COPING_T, COPING_W]} radius={0.012} position={[-halfW - out / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <WoodMaterial />
      </Beam>
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

/**
 * Hareketli güverte: havuzun dört köşesindeki kolonlarda yukarı/aşağı hareket eder.
 * Kompozit panel üst yüz; aşağıda havuz ağzını tamamen kapatır, yukarıda gölgelik olur.
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
}) {
  const out = COPING_W - FRAME_T;
  const dw = w + out * 2 + 0.04;
  const dl = l + out * 2 + 0.04;
  const post = 0.15;
  const px = dw / 2 + post / 2 + 0.02;
  const pz = dl / 2 + post / 2 + 0.02;
  const postTop = top + LIFT_TRAVEL + LIFT_THICK + 0.35;
  const postH = postTop - groundY;

  const deckRef = useRef<THREE.Group>(null);
  const progress = useRef(up ? 1 : 0); // 0 = kapalı (havuz üstü), 1 = yukarıda
  const yFor = (p: number) => top + 0.005 + LIFT_THICK / 2 + p * LIFT_TRAVEL;

  useFrame((state, delta) => {
    const target = up ? 1 : 0;
    const p = progress.current;
    if (Math.abs(p - target) < 0.0005) return;
    // ~5 sn uçtan uca, yumuşak kalkış/duruş
    const step = delta * 0.2;
    const next = p < target ? Math.min(target, p + step) : Math.max(target, p - step);
    progress.current = next;
    const eased = next * next * (3 - 2 * next);
    if (deckRef.current) deckRef.current.position.y = yFor(eased);
    state.invalidate();
  });

  // Alt yüzdeki spotlar
  const spots: [number, number][] = [];
  const nx = Math.max(2, Math.round(dw / 1.6));
  const nz = Math.max(2, Math.round(dl / 1.6));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    spots.push([-dw / 2 + (dw * (i + 0.5)) / nx, -dl / 2 + (dl * (j + 0.5)) / nz]);
  }
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
        {/* Üst yüz: tek parça kompozit panel (gövde renginde, düz, hafif saten) */}
        <Beam args={[dw - rim * 2 + 0.01, 0.03, dl - rim * 2 + 0.01]} radius={0.004} position={[0, LIFT_THICK / 2 - 0.015, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={frame} roughness={0.42} metalness={0.25} envMapIntensity={0.9} />
        </Beam>
        {solar && <SolarArray width={dw - rim * 2} depth={dl - rim * 2} y={LIFT_THICK / 2} />}
        {/* Alt yüz: açık renkli tavan paneli */}
        <mesh position={[0, -LIFT_THICK / 2 + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[dw - rim * 2, dl - rim * 2]} />
          <meshStandardMaterial color="#e9ecee" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        {/* Spotlar */}
        {spots.map(([x, z], i) => (
          <mesh key={`s${i}`} position={[x, -LIFT_THICK / 2 + 0.005, z]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.045, 16]} />
            <meshStandardMaterial color="#fff6e0" emissive="#ffe8b0" emissiveIntensity={isNight ? 3 : 0.6} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {isNight && <pointLight position={[0, -LIFT_THICK / 2 - 0.3, 0]} intensity={4} distance={6} color="#ffe2b0" />}
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
}: {
  entry: 'small_stairs' | 'wide_stairs' | 'bench' | 'none';
  halfW: number;
  halfL: number;
  platformDirection: PlatformDirection;
  color: string;
  claddingTex: THREE.Texture | null;
}) {
  const rim = POOL_HEIGHT - COPING_T;
  const rise = 0.35;
  const run = 0.35;
  const floor = BASIN_FLOOR;
  // İç yüzler
  const ix = halfW - PANEL_T - 0.005;
  const iz = halfL - PANEL_T - 0.005;
  // Basamak ucu: kısa kenar (genişlik uzunluktan küçükse Z uçları)
  const alongX = halfW <= halfL;
  const span = alongX ? ix * 2 : iz * 2;
  const wallCoord = alongX ? iz : ix; // +uç (şelale −Z ucunda)
  // Köşe tarafı: platform bu kısa kenara dikse platforma yakın köşe
  const corner =
    alongX
      ? platformDirection === 'west' ? -1 : 1
      : platformDirection === 'north' ? -1 : 1;

  // (s: kenar boyunca merkezden, d: duvardan içeri) → havuz koordinatı
  type Box = { s0: number; s1: number; d: number; y: number };
  const boxes: Box[] = [];
  const addStairs = (s0: number, s1: number) => {
    for (let k = 1; k <= 3; k++) boxes.push({ s0, s1, d: run * k, y: rim - rise * k });
  };

  if (entry === 'wide_stairs') {
    addStairs(-span / 2, span / 2);
  } else if (entry === 'small_stairs') {
    const w = Math.min(1.0, span * 0.5);
    corner > 0 ? addStairs(span / 2 - w, span / 2) : addStairs(-span / 2, -span / 2 + w);
  } else if (entry === 'bench') {
    const w = Math.min(0.9, span * 0.4);
    const [a, b] = corner > 0 ? [span / 2 - w, span / 2] : [-span / 2, -span / 2 + w];
    addStairs(a, b);
    // Oturma bankı: basamakların yanında kenar boyunca
    const [c0, c1] = corner > 0 ? [-span / 2, a] : [b, span / 2];
    boxes.push({ s0: c0, s1: c1, d: 0.45, y: rim - 0.55 });
  }

  return (
    <group>
      {boxes.map((bx, i) => {
        const len = bx.s1 - bx.s0;
        const h = bx.y - floor;
        const sc = (bx.s0 + bx.s1) / 2;
        const dc = wallCoord - bx.d / 2;
        const position: [number, number, number] = alongX ? [sc, floor + h / 2, dc] : [dc, floor + h / 2, sc];
        const args: [number, number, number] = alongX ? [len, h, bx.d] : [bx.d, h, len];
        return (
          <mesh key={i} position={position} castShadow receiveShadow>
            <boxGeometry args={args} />
            <CladdingMat tex={claddingTex} color={color} sw={len} sh={Math.max(h, bx.d)} roughness={0.8} metalness={0.01} />
          </mesh>
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

function PlatformFurniture({
  pw, pd, top, direction,
}: {
  pw: number; pd: number; top: number; direction: PlatformDirection;
}) {
  // Chair spacing along lengthwise axis
  const lengthHalf = (direction === 'east' || direction === 'west') ? pd / 2 : pw / 2;
  const cs = Math.min(lengthHalf * 0.42, 1.25);
  const y = top;
  // Diagonal angle toward pool (≈17°), making chairs face inward to each other
  /* Chairs face the pool perpendicularly (__/ shape).
     Foot end (+Z of chair) → pool side.
     Backrest (-Z, elevated) → away from pool.
     d = slight inward diagonal so chairs angle toward each other. */
  const d = 0.14;
  const H = Math.PI / 2;

  if (direction === 'east') {
    return (
      <group position={[0, 0, 0]}>
        <LoungeChair position={[0, y, -cs]} rotY={-H + d} />
        <SideTable   position={[0, y,   0]} />
        <LoungeChair position={[0, y,  cs]} rotY={-H - d} />
      </group>
    );
  }
  if (direction === 'west') {
    return (
      <group position={[0, 0, 0]}>
        <LoungeChair position={[0, y, -cs]} rotY={H - d} />
        <SideTable   position={[0, y,   0]} />
        <LoungeChair position={[0, y,  cs]} rotY={H + d} />
      </group>
    );
  }
  if (direction === 'north') {
    return (
      <group position={[0, 0, 0]}>
        <LoungeChair position={[-cs, y, 0]} rotY={ d} />
        <SideTable   position={[  0, y, 0]} />
        <LoungeChair position={[ cs, y, 0]} rotY={-d} />
      </group>
    );
  }
  // south: pool at -Z → rotY≈π
  return (
    <group position={[0, 0, 0]}>
      <LoungeChair position={[-cs, y, 0]} rotY={Math.PI - d} />
      <SideTable   position={[  0, y, 0]} />
      <LoungeChair position={[ cs, y, 0]} rotY={Math.PI + d} />
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
  const sideLen = direction === 'east' || direction === 'west' ? halfL * 2 : halfW * 2;
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
        <WoodMaterial />
      </Beam>

      {/* Support legs at outer corners */}
      <PlatformLegs pw={pw} pd={pd} top={top - deckThickness} bottom={groundY} color={frameColor} />

      {/* Railings: outer + 1 short side opposite the stairs (optional) */}
      {showRailings && (
        <PlatformRailings
          pw={pw}
          pd={pd}
          deckTop={top}
          direction={direction}
          color={frameColor}
          showStairs={hasStairs}
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

      {/* Furniture on outer strip (only when extension is enabled) */}
      {extended && (
        <PlatformFurniture pw={pw} pd={pd} top={top} direction={direction} />
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

  return (
    <group>
      {/* Solid cabinet block */}
      <Beam args={[cabW, cabH, cabD]} radius={0.01} position={[cabCx, cabH / 2, cabCz]} castShadow receiveShadow>
        <PowderCoatMaterial color={frameColor} roughness={0.6} metalness={0.25} />
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
}: {
  pw: number;
  pd: number;
  deckTop: number;
  direction: PlatformDirection;
  color: string;
  showStairs?: boolean;
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
    railings.push({ from: [-halfPw, -halfPd], to: [halfPw, -halfPd] });
    if (!showStairs) {
      // No gap — full railing on stair side too
      railings.push({ from: [-halfPw, halfPd], to: [halfPw, halfPd] });
    } else if (direction === 'east') {
      railings.push({ from: [-halfPw + stairWidth, halfPd], to: [halfPw, halfPd] });
    } else {
      railings.push({ from: [-halfPw, halfPd], to: [halfPw - stairWidth, halfPd] });
    }
  } else {
    const outerZ = direction === 'south' ? halfPd : -halfPd;
    railings.push({ from: [-halfPw, outerZ], to: [halfPw, outerZ] });
    railings.push({ from: [-halfPw, -halfPd], to: [-halfPw, halfPd] });
    if (!showStairs) {
      railings.push({ from: [halfPw, -halfPd], to: [halfPw, halfPd] });
    } else if (direction === 'north') {
      railings.push({ from: [halfPw, -halfPd], to: [halfPw, halfPd - stairWidth] });
    } else {
      railings.push({ from: [halfPw, -halfPd + stairWidth], to: [halfPw, halfPd] });
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

  // Stairs descend PARALLEL to the pool side, on the INNER (pool-side)
  // corner of the platform's front edge.
  if (direction === 'east' || direction === 'west') {
    // East: inner side = -X (pool); West: inner side = +X.
    originX =
      direction === 'east' ? -halfPw + stairWidth / 2 : halfPw - stairWidth / 2;
    originZ = halfPd; // front edge
    descendZ = 1;
    alignAlongX = false;
  } else {
    // North platform: inner side = +Z (pool). South platform: inner side = -Z.
    originX = halfPw; // front edge (descent starts here)
    originZ =
      direction === 'north' ? halfPd - stairWidth / 2 : -halfPd + stairWidth / 2;
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
                <WoodMaterial />
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
            <WoodMaterial />
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
  top: _top,
  waterY,
  frame,
  direction,
  closed = true,
}: {
  w: number;
  l: number;
  top: number;
  waterY: number;
  frame: string;
  direction: PlatformDirection;
  closed?: boolean;
}) {
  // Automatic slatted roller cover ("rulo panjur"). A roller drum sits at one
  // short end; the slats unroll along the pool length (Z axis) to close over
  // the water. Animated: once enabled the slats slide out to fully cover.
  const halfL = l / 2;

  // Drum goes on the short end opposite the platform/stairs. If the platform is
  // on a long side (east/west), default the drum to the north end.
  const drumSide: 'north' | 'south' = direction === 'north' ? 'south' : 'north';
  const dirZ = drumSide === 'north' ? 1 : -1; // slats extend toward +Z or -Z

  const drumR = 0.13;
  const endInset = PANEL_T + 0.06;
  const coverW = w - PANEL_T * 2 - 0.1;   // a bit narrower than the inner span
  const yCover = waterY + 0.04;           // rests just above the water surface

  const zDrum = drumSide === 'north' ? -halfL + drumR + endInset : halfL - drumR - endInset;
  const zStart = zDrum + dirZ * (drumR + 0.02);
  const zClosed = drumSide === 'north' ? halfL - endInset : -halfL + endInset;
  const travel = Math.abs(zClosed - zStart);

  const slatW = 0.14;
  const N = Math.max(4, Math.round(travel / slatW));
  const slatLen = travel / N;
  const slatGap = 0.012;
  const drumLen = coverW + 0.06;

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
      lead.position.z = zStart + dirZ * travel * p;
      lead.visible = p > 0.01;
    }
  };

  useFrame((state, delta) => {
    const target = closed ? 1 : 0;
    const p = progress.current;
    if (Math.abs(p - target) < 0.0005) return;
    // ~2 seconds end-to-end (0.5 units per second), slides both ways
    const step = delta * 0.5;
    const next = p < target ? Math.min(target, p + step) : Math.max(target, p - step);
    progress.current = next;
    applyProgress(next);
    state.invalidate(); // keep animating under demand rendering
  });

  const slatMat = { color: '#c9ced3', roughness: 0.55, metalness: 0.15 };

  return (
    <group>
      {/* Roller drum spanning the pool width */}
      <mesh position={[0, yCover + 0.02, zDrum]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[drumR, drumR, drumLen, 24]} />
        <meshStandardMaterial color={frame} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Side supports / end caps for the drum */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * drumLen) / 2, yCover + 0.02, zDrum]} castShadow receiveShadow>
          <boxGeometry args={[0.05, drumR * 2 + 0.08, drumR * 2 + 0.08]} />
          <meshStandardMaterial color={frame} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}

      {/* Slats — laid flat just above the water, revealed one by one as it closes */}
      {Array.from({ length: N }, (_, i) => {
        const zc = zStart + dirZ * slatLen * (i + 0.5);
        return (
          <mesh
            key={i}
            ref={(m) => { slatRefs.current[i] = m; }}
            position={[0, yCover, zc]}
            visible={false}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[coverW, 0.022, slatLen - slatGap]} />
            <meshStandardMaterial {...slatMat} />
          </mesh>
        );
      })}

      {/* Leading-edge bar that pulls the slats across */}
      <group ref={leadRef} position={[0, yCover, zStart]} visible={false}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[coverW + 0.03, 0.05, 0.06]} />
          <meshStandardMaterial color={frame} roughness={0.45} metalness={0.25} />
        </mesh>
      </group>
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
function CladdingMat({
  tex,
  color,
  sw,
  sh,
  roughness = 0.85,
  metalness = 0,
  envMapIntensity = 0,
  side,
}: {
  tex: THREE.Texture | null;
  color: string;
  sw: number; // yüzey genişliği (metre)
  sh: number; // yüzey yüksekliği (metre)
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  side?: THREE.Side;
}) {
  const [tileW, tileH]: [number, number] = tex?.userData.tileM ?? [CLADDING_TILE, CLADDING_TILE];
  const repeatX = Math.max(1, Math.round(sw / tileW));
  const repeatY = Math.max(1, Math.round(sh / tileH));

  const grout = useMemo(() => {
    const maps = getTileMaps();
    const repeat = [repeatX, repeatY] as const;
    const normal = maps.normal.clone();
    const rough = maps.rough.clone();
    normal.repeat.set(...repeat);
    rough.repeat.set(...repeat);
    normal.needsUpdate = rough.needsUpdate = true;
    return { normal, rough };
  }, [repeatX, repeatY]);

  useEffect(() => () => { grout.normal.dispose(); grout.rough.dispose(); }, [grout]);

  const scaled = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
    return t;
  }, [tex, repeatX, repeatY]);

  useEffect(() => () => { scaled?.dispose(); }, [scaled]);

  return (
    <meshStandardMaterial
      key={scaled?.uuid ?? `no-tex-${sw}-${sh}`}
      color={tex ? '#ffffff' : color}
      map={scaled ?? undefined}
      normalMap={grout.normal}
      roughnessMap={grout.rough}
      roughness={roughness}
      metalness={metalness}
      envMapIntensity={envMapIntensity}
      side={side}
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
