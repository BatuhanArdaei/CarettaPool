'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Pool, groundGeometry, layoutFootprint, poolFootprint, sinkDepth } from './PoolScene';
import { imageToPlane, planeToWorld, projectToImage, type CameraSolution, type Vec2 } from '@/lib/pool/calibration';
import { DAY_ENVIRONMENT, NIGHT_ENVIRONMENT, type PoolTemplate, type TemplatePlacement, type TemplateSun } from '@/lib/pool/templates';
import type { PoolConfig } from '@/lib/types';

const v3 = (v: [number, number, number]) => new THREE.Vector3(...v);

/** Kullanıcının şablon yerleşimine yaptığı düzeltme: zeminde kaydırma (metre) ve ek dönüş (derece). */
export interface PlacementAdjust {
  dA: number;
  dB: number;
  rot: number;
}
export const NO_ADJUST: PlacementAdjust = { dA: 0, dB: 0, rot: 0 };

/** Kaydırma sınırları: havuz görselden kaçmasın, kameranın önünde kalsın. */
export function clampAdjust(adj: PlacementAdjust, base: TemplatePlacement): PlacementAdjust {
  const dA = Math.max(-12, Math.min(12, adj.dA));
  const dB = Math.max(Math.max(-12, 6 - base.centerB), Math.min(12, adj.dB));
  // Yalnızca 4 yön: kenarlar cepheye / zemin derzlerine paralel ya da dik kalır
  const rot = ((Math.round(adj.rot / 90) * 90) % 360 + 360) % 360;
  return { dA, dB, rot };
}

/**
 * Kamerayı kalibrasyondan kurar. Ana nokta merkez dışındaysa (lens kaydırmalı çekim)
 * görüntü, ana noktası merkezde olan daha büyük sanal bir karenin parçası sayılır.
 * Görsel `object-fit: cover` ile kırpıldığı için aynı kırpma setViewOffset ile kameraya
 * uygulanır; fotoğraf ve 3D birebir örtüşür. (Birimler: görüntü yüksekliği = 1000.)
 */
function CalibratedCamera({ solution, aspect, focusX, fit }: { solution: CameraSolution; aspect: number; focusX: number; fit: 'contain' | 'cover' }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera & { manual?: boolean };
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const { width: W, height: H } = size;
    if (!W || !H) return;
    const basis = new THREE.Matrix4().makeBasis(v3(solution.basis.x), v3(solution.basis.y), v3(solution.basis.z));

    camera.manual = true;
    camera.position.copy(v3(solution.position));
    camera.quaternion.setFromRotationMatrix(basis);
    camera.near = 0.1;
    camera.far = 500;

    const imgH = 1000;
    const imgW = 1000 * aspect;
    const [pu, pv] = solution.principal ?? [0.5, 0.5];
    const ppx = pu * imgW;
    const ppy = pv * imgH;
    // Ana noktası merkezde olan sanal kare
    const virtW = 2 * Math.max(ppx, imgW - ppx);
    const virtH = 2 * Math.max(ppy, imgH - ppy);
    camera.fov = (2 * Math.atan(virtH / 2 / solution.focalPx) * 180) / Math.PI;
    camera.aspect = virtW / virtH;

    // Sahnede görünen kısım (görüntü birimlerinde) — CSS object-fit ile aynı
    const wider = W / H > aspect;
    const unitsPerPx = fit === 'cover' ? (wider ? imgW / W : imgH / H) : wider ? imgH / H : imgW / W;
    const viewW = W * unitsPerPx;
    const viewH = H * unitsPerPx;
    const viewX = (imgW - viewW) * focusX;
    const viewY = (imgH - viewH) / 2;
    camera.setViewOffset(virtW, virtH, virtW / 2 - ppx + viewX, virtH / 2 - ppy + viewY, viewW, viewH);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, solution, aspect, focusX, fit, size, invalidate]);

  return null;
}

function Sun({ solution, sun, target }: { solution: CameraSolution; sun: TemplateSun; target: THREE.Vector3 }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  const direction = useMemo(() => {
    const forward = v3(solution.basis.z).negate().setY(0).normalize();
    const right = v3(solution.basis.x).setY(0).normalize();
    const az = THREE.MathUtils.degToRad(sun.azimuth);
    const el = THREE.MathUtils.degToRad(sun.elevation);
    return forward
      .multiplyScalar(-Math.cos(az))
      .add(right.multiplyScalar(-Math.sin(az)))
      .multiplyScalar(Math.cos(el))
      .add(new THREE.Vector3(0, Math.sin(el), 0))
      .normalize();
  }, [solution, sun.azimuth, sun.elevation]);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.position.copy(target).addScaledVector(direction, 40);
    light.target.position.copy(target);
    light.target.updateMatrixWorld();
  }, [direction, target]);

  return (
    <directionalLight
      ref={lightRef}
      color={sun.color}
      intensity={sun.intensity}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-near={1}
      shadow-camera-far={100}
      shadow-camera-left={-16}
      shadow-camera-right={16}
      shadow-camera-top={16}
      shadow-camera-bottom={-16}
    />
  );
}

/** Havuz modelinde platformun bulunduğu yön (yerel X, Z). */
const PLATFORM_DIR: Record<PoolConfig['platformDirection'], [number, number]> = {
  east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1],
};

/**
 * Havuzu kalibrasyon düzlemine yerleştirir. Model dört yönden hangisine çevrildiğinde
 * platform (merdiven, korkuluk, mobilya) YANA bakıyorsa o seçilir: havuzun kendisi ve suyu
 * kameraya açık kalır, platform yanda görünür. Dış merdiven uzak uçta kalıyorsa model
 * aynalanır ve merdiven kameraya yakın uca gelir. `rotation`, şablonun tercih ettiği yönü verir.
 */
function PlacedPool({
  solution,
  placement,
  config,
  night,
  userRotation = 0,
  facade,
  onDragStart,
}: {
  solution: CameraSolution;
  placement: TemplatePlacement;
  config: PoolConfig;
  night: boolean;
  /** Cephe taban çizgisi (düzlem koordinatı); havuz bunun arkasına geçmez */
  facade?: [Vec2, Vec2] | null;
  /** Otomatik yönün üstüne eklenen dönüş (derece), havuz + platform merkezi etrafında */
  userRotation?: number;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const longAxisIsX = config.width > config.length;

  const matrix = useMemo(() => {
    const origin = v3(planeToWorld(placement.centerA, placement.centerB, solution.planeSign));
    const axisA = v3(planeToWorld(1, 0, solution.planeSign));
    const axisB = v3(planeToWorld(0, 1, solution.planeSign));
    const y = new THREE.Vector3(0, 1, 0);
    const toCam = v3(solution.position).sub(origin).setY(0).normalize();
    const camRight = v3(solution.basis.x).setY(0).normalize();
    const [px, pz] = PLATFORM_DIR[config.platformDirection];

    const basisFor = (deg: number) => {
      const r = THREE.MathUtils.degToRad(deg);
      const z = axisA.clone().multiplyScalar(Math.cos(r)).add(axisB.clone().multiplyScalar(Math.sin(r))).normalize();
      return { x: new THREE.Vector3().crossVectors(y, z), z };
    };
    const toWorld = (b: { x: THREE.Vector3; z: THREE.Vector3 }, lx: number, lz: number) =>
      b.x.clone().multiplyScalar(lx).add(b.z.clone().multiplyScalar(lz));

    // 1) Dört yönden en iyisi: uzun kenar şablon yönünde (cepheye paralel), platform yanda ya da
    //    arkada — kameraya doğru olan platform havuzu kapatır, cezalandırılır.
    const base = placement.rotation + (longAxisIsX ? 90 : 0);
    // Uzun kenarın durması gereken yön (rotation = 0 → cepheye paralel, yanal)
    const templateAxis = basisFor(placement.rotation).z;
    let best = { score: -Infinity, b: basisFor(base) };
    for (const extra of [0, 90, 180, 270]) {
      const b = basisFor(base + extra);
      const longAxis = longAxisIsX ? b.x : b.z;
      const p = toWorld(b, px, pz);
      const toward = p.dot(toCam);
      const score =
        Math.abs(longAxis.dot(templateAxis)) -
        (toward > 0.3 ? 1.5 * toward : toward < -0.3 ? 0.3 * -toward : 0) +
        0.01 * p.dot(camRight);
      if (score > best.score) best = { score, b };
    }
    let { x, z } = best.b;

    // 2) Dış merdiven platformun ucunda (doğu/batı platformda +Z, kuzey/güney platformda +X):
    //    kameraya yakın uca, yan yana ise sağ uca gelsin
    const stairsAlongZ = px !== 0;
    const s = toWorld({ x, z }, stairsAlongZ ? 0 : 1, stairsAlongZ ? 1 : 0);
    const stairsScore = Math.abs(s.dot(toCam)) > 0.3 ? s.dot(toCam) : s.dot(camRight);
    if (stairsScore < 0) {
      if (stairsAlongZ) z = z.clone().negate();
      else x = x.clone().negate();
    }

    // 3) Kullanıcı dönüşü (zemin normali etrafında)
    if (userRotation) {
      const q = new THREE.Quaternion().setFromAxisAngle(y, THREE.MathUtils.degToRad(-userRotation));
      x = x.clone().applyQuaternion(q);
      z = z.clone().applyQuaternion(q);
    }

    // Yerleşim noktası havuzun değil, havuz + platform bütününün merkezi olsun
    const fp = layoutFootprint(config);
    const centerOffset = x.clone().multiplyScalar((fp.minX + fp.maxX) / 2).add(z.clone().multiplyScalar((fp.minZ + fp.maxZ) / 2));

    const pos = origin.sub(centerOffset);

    // 4) Cephe sınırı: havuz + makine dairesi köşeleri cephe çizgisinin önünde kalsın
    if (facade) {
      const [f1, f2] = facade;
      const toPlane = (w: THREE.Vector3): Vec2 => [w.x, -w.z * solution.planeSign];
      const cam = toPlane(v3(solution.position));
      let n: Vec2 = [-(f2[1] - f1[1]), f2[0] - f1[0]];
      const len = Math.hypot(n[0], n[1]);
      n = [n[0] / len, n[1] / len];
      // Normal kameraya baksın
      if ((cam[0] - f1[0]) * n[0] + (cam[1] - f1[1]) * n[1] < 0) n = [-n[0], -n[1]];
      const margin = 0.6;
      let worst = Infinity;
      for (const lx of [fp.minX, fp.maxX]) {
        for (const lz of [fp.minZ, fp.maxZ]) {
          const w = pos.clone().add(x.clone().multiplyScalar(lx)).add(z.clone().multiplyScalar(lz));
          const p = toPlane(w);
          worst = Math.min(worst, (p[0] - f1[0]) * n[0] + (p[1] - f1[1]) * n[1] - margin);
        }
      }
      // Yalnızca derinlik yönünde (kameraya doğru) it — yana kaydırma olmasın
      if (worst < 0 && n[1] < -1e-3) pos.add(v3(planeToWorld(0, worst / -n[1], solution.planeSign)));
    }

    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution.planeSign, solution.position, placement.centerA, placement.centerB, placement.rotation, longAxisIsX, config.platformDirection, config.width, config.length, config.platformExtension, (config.extensionSides ?? []).join(), userRotation, facade]);

  // Havuzun tüm parçaları gölge atsın/alsın (ana sahnedeki EnableAllShadows'un karşılığı)
  useEffect(() => {
    groupRef.current?.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !obj.userData.photoGround) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    invalidate();
  }, [config, invalidate]);

  return (
    <group ref={groupRef} matrix={matrix} matrixAutoUpdate={false}>
      <PhotoGround config={config} shadowOpacity={night ? 0.18 : 0.32} />
      {/* Sürükleme yalnızca havuzun kendisinden başlar (dev fotoğraf zemininden değil) */}
      <group
        onPointerDown={onDragStart}
        onPointerOver={onDragStart ? () => (document.body.style.cursor = 'grab') : undefined}
        onPointerOut={onDragStart ? () => (document.body.style.cursor = '') : undefined}
      >
        <Pool config={config} isNight={night} groundPatch="kerb" />
      </group>
    </group>
  );
}

/**
 * Fotoğraftaki zeminin 3D karşılığı (havuz yerel koordinatlarında):
 * - gölge yakalayıcı: havuzun gölgesini fotoğraftaki zemine düşürür
 * - gömülü kurulumda maske: pikselleri boyamadan derinlik yazar, havuzun zemin altındaki kısmını gizler
 * Her ikisi de havuz izdüşümü kadar deliklidir.
 */
function PhotoGround({ config, shadowOpacity }: { config: PoolConfig; shadowOpacity: number }) {
  const sunk = sinkDepth(config) > 0;
  const hole = sunk ? poolFootprint(config) : null;
  const key = hole ? [hole.minX, hole.maxX, hole.minZ, hole.maxZ].join(',') : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => groundGeometry(120, 120, hole), [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <>
      {sunk && (
        <mesh geometry={geometry} renderOrder={-1} castShadow userData={{ photoGround: true }}>
          <meshBasicMaterial colorWrite={false} />
        </mesh>
      )}
      <mesh geometry={geometry} position={[0, 0.002, 0]} receiveShadow userData={{ photoGround: true }}>
        <shadowMaterial opacity={shadowOpacity} />
      </mesh>
    </>
  );
}

function Invalidator({ deps, animate }: { deps: unknown[]; animate: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { invalidate(); }, deps);
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => invalidate(), 1000 / 30);
    return () => clearInterval(id);
  }, [animate, invalidate]);
  return null;
}

/**
 * Havuzu zemin düzleminde sürükler: imleç kameradan zemine (y = 0) ışınla izdüşürülür,
 * böylece havuz fotoğrafın perspektifinde kayar. Tutulan nokta ile merkez arasındaki fark korunur.
 */
function DragController({
  solution,
  aspect,
  base,
  adjust,
  onAdjust,
  startRef,
}: {
  solution: CameraSolution;
  aspect: number;
  base: TemplatePlacement;
  adjust: PlacementAdjust;
  onAdjust?: (adjust: PlacementAdjust) => void;
  startRef: React.MutableRefObject<((e: ThreeEvent<PointerEvent>) => void) | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const latest = useRef({ adjust, onAdjust, base });
  latest.current = { adjust, onAdjust, base };

  const groundAt = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      // Dünya (x, z) → düzlem (a, b)
      return hit ? { a: hit.x, b: -hit.z * solution.planeSign } : null;
    },
    [camera, gl, solution.planeSign],
  );

  useEffect(() => {
    startRef.current = (e) => {
      const { onAdjust: cb } = latest.current;
      if (!cb) return;
      e.stopPropagation();
      const start = groundAt(e.nativeEvent.clientX, e.nativeEvent.clientY);
      if (!start) return;
      const from = latest.current.adjust;
      document.body.style.cursor = 'grabbing';
      const move = (ev: PointerEvent) => {
        const p = groundAt(ev.clientX, ev.clientY);
        const { onAdjust: cb2, base: b } = latest.current;
        if (!p || !cb2) return;
        const next = clampAdjust({ dA: from.dA + p.a - start.a, dB: from.dB + p.b - start.b, rot: from.rot }, b);
        // Havuz merkezi görselin görünür alanında kalsın (kenardan taşmasın)
        const c = projectToImage(solution, aspect, planeToWorld(b.centerA + next.dA, b.centerB + next.dB, solution.planeSign));
        if (!c || c[0] < 0.12 || c[0] > 0.88 || c[1] < 0.4 || c[1] > 0.84) return;
        cb2(next);
      };
      const up = () => {
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };
    return () => {
      startRef.current = null;
    };
  }, [groundAt, startRef, solution, aspect]);

  return null;
}

export default function TemplateScene({
  template,
  solution,
  config,
  night = false,
  placement,
  sun,
  fit = 'cover',
  adjust = NO_ADJUST,
  onAdjust,
}: {
  template: PoolTemplate;
  solution: CameraSolution;
  config: PoolConfig;
  night?: boolean;
  fit?: 'contain' | 'cover';
  placement?: TemplatePlacement;
  sun?: TemplateSun;
  /** Kullanıcı düzeltmesi (kaydırma + dönüş) */
  adjust?: PlacementAdjust;
  /** Verilirse havuz sürüklenebilir */
  onAdjust?: (adjust: PlacementAdjust) => void;
}) {
  const basePlace = placement ?? template.placement;
  const place = useMemo(
    () => ({ ...basePlace, centerA: basePlace.centerA + adjust.dA, centerB: basePlace.centerB + adjust.dB }),
    [basePlace, adjust.dA, adjust.dB],
  );
  const daySun = sun ?? template.sun;
  // Gece: ay ışığı (soğuk, zayıf) + görseldeki sıcak aydınlatmaya uyan dolgu ışığı
  const dragStartRef = useRef<((e: ThreeEvent<PointerEvent>) => void) | null>(null);
  const facade = useMemo(() => {
    if (!template.facade) return null;
    const a = imageToPlane(solution, template.aspect, template.facade[0]);
    const b = imageToPlane(solution, template.aspect, template.facade[1]);
    return a && b ? ([a, b] as [Vec2, Vec2]) : null;
  }, [solution, template.aspect, template.facade]);
  const light: TemplateSun = night
    ? { azimuth: daySun.azimuth, elevation: 50, intensity: 0.35, color: '#b4c4ff' }
    : daySun;
  const target = useMemo(
    () => v3(planeToWorld(place.centerA, place.centerB, solution.planeSign)),
    [place.centerA, place.centerB, solution.planeSign],
  );

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
      style={{ position: 'absolute', inset: 0, touchAction: onAdjust ? 'none' : undefined }}
    >
      <DragController
        solution={solution}
        aspect={template.aspect}
        base={basePlace}
        adjust={adjust}
        onAdjust={onAdjust}
        startRef={dragStartRef}
      />
      <CalibratedCamera solution={solution} aspect={template.aspect} focusX={template.focusX} fit={fit} />
      <ambientLight intensity={night ? 0.22 : 0.35} color={night ? '#ffd3a1' : '#dfeeff'} />
      <Sun solution={solution} sun={light} target={target} />
      <Suspense fallback={null}>
        <Environment
          files={night ? NIGHT_ENVIRONMENT : DAY_ENVIRONMENT}
          background={false}
          environmentIntensity={night ? 0.7 : 1}
        />
        <PlacedPool
          solution={solution}
          placement={place}
          config={config}
          night={night}
          userRotation={adjust.rot}
          facade={facade}
          onDragStart={onAdjust ? (e) => dragStartRef.current?.(e) : undefined}
        />
      </Suspense>
      <Invalidator deps={[config, place, light, solution, night, adjust.rot]} animate={config.showWater || config.lighting.enabled} />
    </Canvas>
  );
}
