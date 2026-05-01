'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Environment,
  GizmoHelper,
  GizmoViewcube,
  OrbitControls,
  Sky,
  Stars,
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  POOL_SIDES,
  getPanelType,
  type CladdingType,
  type FrameColor,
  type GroundType,
  type LightColor,
  type PoolConfig,
  type PoolSide,
  type PlatformDirection,
} from '@/lib/types';

const POOL_HEIGHT = 1.5;
const COPING_T = 0.10;
const COPING_W = 0.32;
const FRAME_T = 0.10;
const PANEL_T = 0.04;
const BASIN_FLOOR = 0.06;
const PLATFORM_DEPTH = 2.0;

export default function PoolScene({
  config,
  controlsRef,
}: {
  config: PoolConfig;
  controlsRef?: React.MutableRefObject<{ reset: () => void } | null>;
}) {
  const isNight = config.lighting.enabled;
  return (
    <Canvas shadows camera={{ position: [12, 9, 14], fov: 42 }}>
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
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            {/* Soft fill from opposite side */}
            <directionalLight position={[-12, 8, -10]} intensity={0.18} color="#8ea4cc" />
          </>
        ) : (
          <>
            <Sky sunPosition={[100, 30, 100]} turbidity={2} rayleigh={1} />
            <ambientLight intensity={0.5} />
            {/* Sun directional light — same direction as the visible sun sphere */}
            <directionalLight
              position={[20, 18, 18]}
              intensity={1.4}
              color="#fff5dc"
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            {/* Visible sun disk in the sky */}
            <mesh position={[100, 30, 100]}>
              <sphereGeometry args={[7, 24, 24]} />
              <meshBasicMaterial color="#fff8d6" toneMapped={false} />
            </mesh>
            {/* Soft halo around the sun */}
            <mesh position={[100, 30, 100]}>
              <sphereGeometry args={[10, 16, 16]} />
              <meshBasicMaterial
                color="#ffe8a0"
                transparent
                opacity={0.35}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          </>
        )}
        {/* Environment IBL — gives glass/metal materials proper reflections */}
        <Environment preset={isNight ? 'night' : 'sunset'} background={false} />
        <Garden ground={config.ground} isNight={isNight} />
        <Trees isNight={isNight} />
        <VillaSlot isNight={isNight} />
        <Fence isNight={isNight} />
        <Pool config={config} />
        <OrbitControls
          ref={controlsRef as React.MutableRefObject<null>}
          enablePan
          enableZoom
          enableRotate
          minDistance={4}
          maxDistance={18}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, POOL_HEIGHT / 2, 0]}
        />
        {/* Navigation cube — click faces to snap to that view */}
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewcube
            color="#0e7490"
            opacity={0.85}
            strokeColor="#155e75"
            textColor="#ffffff"
            faces={['Sağ', 'Sol', 'Üst', 'Alt', 'Ön', 'Arka']}
          />
        </GizmoHelper>
      </Suspense>
    </Canvas>
  );
}

function Garden({ ground, isNight }: { ground: GroundType; isNight: boolean }) {
  const lawn = isNight ? '#1f3a2a' : '#3a7a3a';
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={lawn} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={groundColor(ground, isNight)} />
      </mesh>
    </>
  );
}

function Trees({ isNight }: { isNight: boolean }) {
  const positions = useMemo<[number, number, number][]>(
    () => [
      [18, 0, -10],
      [-18, 0, 6],
      [20, 0, 14],
      [-16, 0, 20],
      [12, 0, 21],
      [-20, 0, -8],
      [22, 0, 4],
      [-22, 0, -16],
    ],
    []
  );
  const trunk = isNight ? '#2a1c10' : '#5b3a1e';
  const foliage1 = isNight ? '#1a3a1a' : '#2d6a2d';
  const foliage2 = isNight ? '#1d4220' : '#327a32';
  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 1.2, 8]} />
            <meshStandardMaterial color={trunk} />
          </mesh>
          <mesh castShadow position={[0, 1.8, 0]}>
            <coneGeometry args={[0.9, 1.8, 10]} />
            <meshStandardMaterial color={foliage1} />
          </mesh>
          <mesh castShadow position={[0, 2.6, 0]}>
            <coneGeometry args={[0.7, 1.4, 10]} />
            <meshStandardMaterial color={foliage2} />
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
      {/* Upper left side */}
      <mesh position={[-W / 2, H1 + 0.16 + H2 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H2, D]} />
        <meshStandardMaterial color={concrete} roughness={0.85} />
      </mesh>
      {/* Upper right side */}
      <mesh position={[W / 2, H1 + 0.16 + H2 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H2, D]} />
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
        {/* Wing back/left/front walls */}
        <mesh position={[0, wingH / 2, -wingD / 2]} castShadow receiveShadow>
          <boxGeometry args={[wingW, wingH, 0.2]} />
          <meshStandardMaterial color={concrete} roughness={0.85} />
        </mesh>
        <mesh position={[-wingW / 2, wingH / 2, 0]} castShadow receiveShadow>
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

function Pool({ config }: { config: PoolConfig }) {
  const w = config.width;
  const l = config.length;
  const halfW = w / 2;
  const halfL = l / 2;

  const top = POOL_HEIGHT;
  const waterY = top - COPING_T - 0.12;

  const frame = frameColorHex(config.frameColor);
  const inner = claddingColor(config.cladding);
  const claddingTex = useCladdingTexture(config.cladding);

  return (
    <group>
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
        <meshStandardMaterial
          color={claddingTex ? '#ffffff' : inner}
          map={claddingTex}
        />
      </mesh>

      {/* Inner cladding rim — visible above water line */}
      <InnerRim w={w} l={l} waterY={waterY} top={top - COPING_T} color={inner} />

      {/* Water volume — the body of water inside the pool, visible through glass */}
      <WaterVolume w={w} l={l} waterY={waterY} />

      {/* Side panels — one mesh per (side, segment) so each can be glass/closed */}
      <SidePanels
        halfW={halfW}
        halfL={halfL}
        top={top}
        segments={config.panelSegments}
        config={config}
        frame={frame}
      />

      {/* Vertical mullions dividing each side into segments */}
      <Mullions
        halfW={halfW}
        halfL={halfL}
        top={top}
        segments={config.panelSegments}
        color={frame}
      />

      {/* 4 corner posts */}
      <CornerPosts halfW={halfW} halfL={halfL} top={top} color={frame} />

      {/* Bottom + top frame beams (decorative trim) */}
      <FrameBeams w={w} l={l} halfW={halfW} halfL={halfL} top={top} color={frame} />

      {/* Wood coping */}
      <Coping w={w} l={l} y={top} />

      {/* Water top surface — slight reflective plane above the volume */}
      <WaterTopSurface
        w={w}
        l={l}
        waterY={waterY}
        lightEnabled={config.lighting.enabled}
        lightColor={config.lighting.color}
      />

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
      {config.waterfall && <Waterfall halfL={halfL} top={top} />}

      {/* In-pool ladder */}
      <PoolLadder
        halfW={halfW}
        halfL={halfL}
        top={top}
        waterY={waterY}
        platformDirection={config.platformDirection}
      />

      {/* Side platform + stairs + railings */}
      <Platform
        halfW={halfW}
        halfL={halfL}
        top={top}
        direction={config.platformDirection}
        frameColor={frame}
      />
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
  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, top / 2, z]} castShadow>
          <boxGeometry args={[FRAME_T, top, FRAME_T]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function Mullions({
  halfW,
  halfL,
  top,
  segments,
  color,
}: {
  halfW: number;
  halfL: number;
  top: number;
  segments: number;
  color: string;
}) {
  if (segments <= 1) return null;
  const panelHeight = top - COPING_T - BASIN_FLOOR;
  const yMid = BASIN_FLOOR + panelHeight / 2;
  const mullionT = 0.07;
  const mullionD = 0.09; // depth into the wall (slightly more than panel)
  const w = halfW * 2;
  const l = halfL * 2;

  // Distribute (segments - 1) mullions evenly along each side.
  const offsetsX: number[] = [];
  const offsetsZ: number[] = [];
  for (let i = 1; i < segments; i++) {
    offsetsX.push(-halfW + (i / segments) * w);
    offsetsZ.push(-halfL + (i / segments) * l);
  }

  return (
    <group>
      {/* Mullions on +Z and -Z walls (run along X) */}
      {offsetsX.map((x, i) => (
        <group key={`x${i}`}>
          <mesh position={[x, yMid, halfL - mullionD / 2]} castShadow>
            <boxGeometry args={[mullionT, panelHeight, mullionD]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[x, yMid, -halfL + mullionD / 2]} castShadow>
            <boxGeometry args={[mullionT, panelHeight, mullionD]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
          </mesh>
        </group>
      ))}
      {/* Mullions on +X and -X walls (run along Z) */}
      {offsetsZ.map((z, i) => (
        <group key={`z${i}`}>
          <mesh position={[halfW - mullionD / 2, yMid, z]} castShadow>
            <boxGeometry args={[mullionD, panelHeight, mullionT]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[-halfW + mullionD / 2, yMid, z]} castShadow>
            <boxGeometry args={[mullionD, panelHeight, mullionT]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SidePanels({
  halfW,
  halfL,
  top,
  segments,
  config,
  frame,
}: {
  halfW: number;
  halfL: number;
  top: number;
  segments: number;
  config: PoolConfig;
  frame: string;
}) {
  const panelHeight = top - COPING_T - BASIN_FLOOR;
  const yMid = BASIN_FLOOR + panelHeight / 2;
  const innerW = halfW * 2 - FRAME_T * 2;
  const innerL = halfL * 2 - FRAME_T * 2;
  const segGap = 0.02; // tiny visual gap between segments

  // Map of side → wall geometry parameters
  // axis === 'x' means the wall extends along X axis (north/south walls)
  // axis === 'z' means the wall extends along Z axis (east/west walls)
  const sides: {
    name: PoolSide;
    axis: 'x' | 'z';
    wallCoord: number;       // fixed coord (z for north/south, x for east/west)
    spanInner: number;       // length along the axis
    panelDepth: number;      // PANEL_T (thickness perpendicular to the wall)
  }[] = [
    { name: 'south', axis: 'x', wallCoord: halfL - PANEL_T / 2, spanInner: innerW, panelDepth: PANEL_T },
    { name: 'north', axis: 'x', wallCoord: -halfL + PANEL_T / 2, spanInner: innerW, panelDepth: PANEL_T },
    { name: 'east', axis: 'z', wallCoord: halfW - PANEL_T / 2, spanInner: innerL, panelDepth: PANEL_T },
    { name: 'west', axis: 'z', wallCoord: -halfW + PANEL_T / 2, spanInner: innerL, panelDepth: PANEL_T },
  ];

  return (
    <group>
      {sides.flatMap((side) => {
        const segLen = side.spanInner / segments;
        return Array.from({ length: segments }, (_, i) => {
          const type = getPanelType(config, side.name, i);
          const center = -side.spanInner / 2 + segLen * (i + 0.5);
          const isGlass = type === 'glass';

          const sizeAlong = segLen - segGap;
          const args: [number, number, number] =
            side.axis === 'x'
              ? [sizeAlong, panelHeight, side.panelDepth]
              : [side.panelDepth, panelHeight, sizeAlong];

          const position: [number, number, number] =
            side.axis === 'x'
              ? [center, yMid, side.wallCoord]
              : [side.wallCoord, yMid, center];

          return (
            <mesh
              key={`${side.name}-${i}`}
              position={position}
              castShadow
              receiveShadow
              renderOrder={2}
            >
              <boxGeometry args={args} />
              {isGlass ? (
                <meshStandardMaterial
                  color="#bcdfee"
                  transparent
                  opacity={0.25}
                  roughness={0.05}
                  metalness={0}
                  depthWrite={false}
                />
              ) : (
                <meshStandardMaterial
                  color={frame}
                  roughness={0.6}
                  metalness={0.25}
                />
              )}
            </mesh>
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
}: {
  w: number;
  l: number;
  waterY: number;
  top: number;
  color: string;
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
        <meshStandardMaterial color={color} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[0, yMid, -halfL]}>
        <planeGeometry args={[w - inset * 2, rimHeight]} />
        <meshStandardMaterial color={color} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[halfW, yMid, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[l - inset * 2, rimHeight]} />
        <meshStandardMaterial color={color} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[-halfW, yMid, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[l - inset * 2, rimHeight]} />
        <meshStandardMaterial color={color} side={THREE.FrontSide} />
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
      {/* Volume of water — dense blue so you don't see through to the other side */}
      <mesh position={[0, yMid, 0]} renderOrder={1}>
        <boxGeometry args={[w - inset * 2, height, l - inset * 2]} />
        <meshStandardMaterial
          color="#1574a8"
          transparent
          opacity={0.94}
          roughness={0.3}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function WaterTopSurface({
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
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!lightEnabled || lightColor !== 'rgb') return;
    const mat = meshRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    const t = state.clock.elapsedTime;
    const hue = (t * 0.08) % 1;
    mat.emissive.setHSL(hue, 0.9, 0.45);
  });

  const initialEmissive = lightEnabled
    ? lightColor === 'rgb'
      ? '#ff3b3b'
      : lightColorHex(lightColor)
    : '#000000';

  return (
    <mesh
      ref={meshRef}
      position={[0, waterY + 0.003, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[w - PANEL_T * 2 - 0.05, l - PANEL_T * 2 - 0.05]} />
      <meshStandardMaterial
        color="#4cb5dc"
        transparent
        opacity={0.85}
        roughness={0.08}
        metalness={0.4}
        emissive={initialEmissive}
        emissiveIntensity={lightEnabled ? 0.35 : 0}
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
    if (color !== 'rgb') return;
    const t = state.clock.elapsedTime;
    const hue = (t * 0.08) % 1;
    const c = new THREE.Color().setHSL(hue, 0.95, 0.55);
    refs.current.forEach((mesh) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(c);
      mat.color.copy(c);
    });
  });

  const baseColor = color === 'rgb' ? '#ff3b3b' : lightColorHex(color);
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
    if (color !== 'rgb') return;
    const t = state.clock.elapsedTime;
    const hue = (t * 0.08) % 1;
    const c = new THREE.Color().setHSL(hue, 0.95, 0.55);
    refs.current.forEach((light) => {
      if (light) light.color.copy(c);
    });
  });

  const baseColor = color === 'rgb' ? '#ff3b3b' : lightColorHex(color);
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
      <mesh position={[0, beamY, halfL - FRAME_T / 2]} castShadow>
        <boxGeometry args={[w, beamH, FRAME_T * 0.7]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, beamY, -halfL + FRAME_T / 2]} castShadow>
        <boxGeometry args={[w, beamH, FRAME_T * 0.7]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[halfW - FRAME_T / 2, beamY, 0]} castShadow>
        <boxGeometry args={[FRAME_T * 0.7, beamH, l]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[-halfW + FRAME_T / 2, beamY, 0]} castShadow>
        <boxGeometry args={[FRAME_T * 0.7, beamH, l]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      {/* Bottom skirt beams */}
      <mesh position={[0, BASIN_FLOOR + 0.05, halfL - FRAME_T / 2]} castShadow>
        <boxGeometry args={[w, 0.1, FRAME_T * 0.7]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, BASIN_FLOOR + 0.05, -halfL + FRAME_T / 2]} castShadow>
        <boxGeometry args={[w, 0.1, FRAME_T * 0.7]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[halfW - FRAME_T / 2, BASIN_FLOOR + 0.05, 0]} castShadow>
        <boxGeometry args={[FRAME_T * 0.7, 0.1, l]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[-halfW + FRAME_T / 2, BASIN_FLOOR + 0.05, 0]} castShadow>
        <boxGeometry args={[FRAME_T * 0.7, 0.1, l]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Coping({ w, l, y }: { w: number; l: number; y: number }) {
  const halfW = w / 2;
  const halfL = l / 2;
  const out = COPING_W - FRAME_T; // how far coping extends outward
  const totalW = w + out * 2;
  const totalL = l + out * 2;
  const woodColor = '#a4753a';
  return (
    <group position={[0, y - COPING_T / 2, 0]}>
      {/* +Z (south) beam */}
      <mesh position={[0, 0, halfL + out / 2]} castShadow receiveShadow>
        <boxGeometry args={[totalW, COPING_T, COPING_W]} />
        <meshStandardMaterial color={woodColor} roughness={0.85} />
      </mesh>
      {/* -Z (north) beam */}
      <mesh position={[0, 0, -halfL - out / 2]} castShadow receiveShadow>
        <boxGeometry args={[totalW, COPING_T, COPING_W]} />
        <meshStandardMaterial color={woodColor} roughness={0.85} />
      </mesh>
      {/* +X (east) beam */}
      <mesh position={[halfW + out / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[COPING_W, COPING_T, l]} />
        <meshStandardMaterial color={woodColor} roughness={0.85} />
      </mesh>
      {/* -X (west) beam */}
      <mesh position={[-halfW - out / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[COPING_W, COPING_T, l]} />
        <meshStandardMaterial color={woodColor} roughness={0.85} />
      </mesh>
    </group>
  );
}

function PoolLadder({
  halfW,
  halfL,
  top,
  waterY,
  platformDirection,
}: {
  halfW: number;
  halfL: number;
  top: number;
  waterY: number;
  platformDirection: PlatformDirection;
}) {
  // Pool ladder: two parallel rails + horizontal rungs.
  // Rails curve OVER at the top in an oval and land on the platform deck.
  const railSpacing = 0.46;
  const railR = 0.028;
  const rungR = 0.022;
  const inset = PANEL_T + 0.28;
  const railBottomY = waterY - 0.85;
  const numRungs = 5;
  const rungYBottom = waterY - 0.5;
  const rungYTop = top - 0.18;

  let baseX = 0;
  let baseZ = 0;
  let rungAxis: 'x' | 'z' = 'z';
  // Direction the curl bends OUT toward (the platform side, away from pool wall)
  let curlOutX = 0;
  let curlOutZ = 0;

  if (platformDirection === 'east') {
    baseX = halfW - inset;
    rungAxis = 'z';
    curlOutX = 1;
  } else if (platformDirection === 'west') {
    baseX = -halfW + inset;
    rungAxis = 'z';
    curlOutX = -1;
  } else if (platformDirection === 'north') {
    baseZ = -halfL + inset;
    rungAxis = 'x';
    curlOutZ = -1;
  } else {
    baseZ = halfL - inset;
    rungAxis = 'x';
    curlOutZ = 1;
  }

  const offsets = [-railSpacing / 2, railSpacing / 2];
  const chrome = '#f5f5f5';

  // Build a tube geometry per rail: vertical from underwater up, then curls
  // outward and back down to land on the deck.
  const railGeos = useMemo(
    () =>
      offsets.map((off) => {
        const x = baseX + (rungAxis === 'z' ? 0 : off);
        const z = baseZ + (rungAxis === 'z' ? off : 0);
        const curlR = 0.22; // radius of the curl loop
        const curlPeakY = top + curlR + 0.05;

        const points = [
          // Bottom — deep in water
          new THREE.Vector3(x, railBottomY, z),
          // Just below water
          new THREE.Vector3(x, waterY - 0.2, z),
          // At deck level — start of the curl
          new THREE.Vector3(x, top + 0.05, z),
          // Apex of the curl, slightly forward
          new THREE.Vector3(
            x + curlOutX * curlR * 0.7,
            curlPeakY,
            z + curlOutZ * curlR * 0.7
          ),
          // Coming down on the platform side
          new THREE.Vector3(
            x + curlOutX * curlR * 1.6,
            top + curlR * 0.3,
            z + curlOutZ * curlR * 1.6
          ),
          // Landing on the deck
          new THREE.Vector3(
            x + curlOutX * curlR * 1.9,
            top + 0.04,
            z + curlOutZ * curlR * 1.9
          ),
        ];

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
        return new THREE.TubeGeometry(curve, 80, railR, 10, false);
      }),
    [baseX, baseZ, rungAxis, curlOutX, curlOutZ, railBottomY, top, waterY]
  );

  return (
    <group>
      {/* Two curved rails (with oval curl at top landing on deck) */}
      {railGeos.map((geo, i) => (
        <mesh key={`rail-${i}`} geometry={geo} castShadow>
          <meshStandardMaterial color={chrome} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}

      {/* Horizontal rungs (straight, unchanged) */}
      {Array.from({ length: numRungs }, (_, i) => {
        const t = i / (numRungs - 1);
        const y = rungYBottom + t * (rungYTop - rungYBottom);
        return (
          <mesh
            key={`rung-${i}`}
            position={[baseX, y, baseZ]}
            rotation={rungAxis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[rungR, rungR, railSpacing, 10]} />
            <meshStandardMaterial color={chrome} metalness={0.4} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function Platform({
  halfW,
  halfL,
  top,
  direction,
  frameColor,
}: {
  halfW: number;
  halfL: number;
  top: number;
  direction: PlatformDirection;
  frameColor: string;
}) {
  // Determine platform footprint.
  // The platform sits flush against the chosen pool side.
  const wood = '#b8853f';
  const deckThickness = 0.1;
  const deckY = top - deckThickness / 2;

  let cx = 0, cz = 0; // platform center
  let pw = 0, pd = 0; // platform width, depth (depth = outward extent)
  const sideLen = direction === 'east' || direction === 'west'
    ? halfL * 2
    : halfW * 2;

  pw = direction === 'east' || direction === 'west' ? PLATFORM_DEPTH : sideLen;
  pd = direction === 'east' || direction === 'west' ? sideLen : PLATFORM_DEPTH;

  if (direction === 'east') {
    cx = halfW + COPING_W - FRAME_T + PLATFORM_DEPTH / 2;
    cz = 0;
  } else if (direction === 'west') {
    cx = -halfW - (COPING_W - FRAME_T) - PLATFORM_DEPTH / 2;
    cz = 0;
  } else if (direction === 'north') {
    cx = 0;
    cz = -halfL - (COPING_W - FRAME_T) - PLATFORM_DEPTH / 2;
  } else {
    cx = 0;
    cz = halfL + (COPING_W - FRAME_T) + PLATFORM_DEPTH / 2;
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
      />

      {/* Deck floor */}
      <mesh position={[0, deckY, 0]} castShadow receiveShadow>
        <boxGeometry args={[pw, deckThickness, pd]} />
        <meshStandardMaterial color={wood} roughness={0.85} />
      </mesh>

      {/* Support legs at outer corners */}
      <PlatformLegs pw={pw} pd={pd} top={top - deckThickness} color={frameColor} />

      {/* Railings: outer + 1 short side opposite the stairs */}
      <PlatformRailings
        pw={pw}
        pd={pd}
        deckTop={top}
        direction={direction}
        color={frameColor}
      />

      {/* Stairs descending from one corner */}
      <Stairs
        pw={pw}
        pd={pd}
        deckTop={top}
        direction={direction}
        frameColor={frameColor}
      />
    </group>
  );
}

function PlatformBlock({
  pw,
  pd,
  top,
  direction,
  frameColor,
}: {
  pw: number;
  pd: number;
  top: number;
  direction: PlatformDirection;
  frameColor: string;
}) {
  // Partial closed cabinet (machine room) — covers only the half adjacent to
  // the pool, and extends inward to merge with the pool wall (closes the gap
  // between the coping and the platform).
  const halfPw = pw / 2;
  const halfPd = pd / 2;
  const cabH = top - 0.04;
  // Distance from the platform's inner edge to the actual pool wall (the gap
  // hidden by the coping when looked at from above).
  const innerExtension = COPING_W - FRAME_T;
  // Cabinet covers ~60% of the platform's depth, on the pool-facing side.
  const cabPartial = pw * 0.6;

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
      <mesh position={[cabCx, cabH / 2, cabCz]} castShadow receiveShadow>
        <boxGeometry args={[cabW, cabH, cabD]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.6}
          metalness={0.25}
        />
      </mesh>
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
  color,
}: {
  pw: number;
  pd: number;
  top: number;
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
        <mesh key={i} position={[x, top / 2, z]} castShadow>
          <boxGeometry args={[FRAME_T, top, FRAME_T]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.45} />
        </mesh>
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
}: {
  pw: number;
  pd: number;
  deckTop: number;
  direction: PlatformDirection;
  color: string;
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
    // Outer side (parallel to pool) — full length
    railings.push({ from: [outerX, -halfPd], to: [outerX, halfPd] });
    // -Z end (far from stairs)
    railings.push({ from: [-halfPw, -halfPd], to: [halfPw, -halfPd] });
    // +Z end (front) — railing covers the OUTER half; stairs occupy the inner half.
    // East: stairs at -halfPw → -halfPw+stairWidth (inner). Railing fills the rest.
    // West: stairs at halfPw-stairWidth → halfPw (inner). Railing fills the rest.
    if (direction === 'east') {
      railings.push({ from: [-halfPw + stairWidth, halfPd], to: [halfPw, halfPd] });
    } else {
      railings.push({ from: [-halfPw, halfPd], to: [halfPw - stairWidth, halfPd] });
    }
  } else {
    const outerZ = direction === 'south' ? halfPd : -halfPd;
    // Outer side — full length
    railings.push({ from: [-halfPw, outerZ], to: [halfPw, outerZ] });
    // -X end (far from stairs)
    railings.push({ from: [-halfPw, -halfPd], to: [-halfPw, halfPd] });
    // +X end (front) — covers the side opposite the stair landing
    if (direction === 'north') {
      // Stairs at halfPd-stairWidth → halfPd (inner). Railing on the rest.
      railings.push({ from: [halfPw, -halfPd], to: [halfPw, halfPd - stairWidth] });
    } else {
      // South: stairs at -halfPd → -halfPd+stairWidth (inner)
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
  direction,
  frameColor,
}: {
  pw: number;
  pd: number;
  deckTop: number;
  direction: PlatformDirection;
  frameColor: string;
}) {
  // Stairs descend from deck level to ground over ~5 steps.
  const steps = 5;
  const totalRise = deckTop;
  const stepRise = totalRise / steps;
  const stepRun = 0.32;
  const stairWidth = 0.9;
  const treadColor = '#b8853f';

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
        const sizeX = alignAlongX ? stepRun : stairWidth;
        const sizeZ = alignAlongX ? stairWidth : stepRun;
        return (
          <mesh
            key={i}
            position={[cx, yTop + 0.025, cz]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[sizeX, 0.05, sizeZ]} />
            <meshStandardMaterial color={treadColor} roughness={0.85} />
          </mesh>
        );
      })}

      {/* Stair handrails on both sides */}
      <StairRail
        originX={originX}
        originZ={originZ}
        descendX={descendX}
        descendZ={descendZ}
        steps={steps}
        stepRun={stepRun}
        stepRise={stepRise}
        deckTop={deckTop}
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
        sideOffset={alignAlongX ? -stairWidth / 2 : stairWidth / 2}
        sideAxis={alignAlongX ? 'z' : 'x'}
        color={frameColor}
      />
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
  const endY = railHeight;

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

  const baseZ = -halfL + 0.1; // outer face of the waterfall, on the coping
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

function groundColor(g: GroundType, isNight = false): string {
  const day = {
    gravel: '#b0b0a8',
    wood: '#8a5a2d',
    grass: '#4ea24e',
    concrete: '#cfd1d4',
  } as const;
  const night = {
    gravel: '#5a5a52',
    wood: '#4a3018',
    grass: '#1f4a1f',
    concrete: '#5a5d62',
  } as const;
  return (isNight ? night : day)[g];
}

function claddingColor(c: CladdingType): string {
  switch (c) {
    case 'white': return '#f1f5f9';
    case 'blue_mosaic': return '#2563eb';
    case 'gray_stone': return '#6b7280';
    case 'turquoise': return '#14b8a6';
    case 'texture1':
    case 'texture2':
    case 'texture3':
    case 'texture4':
    case 'texture5':
      return '#cfd5dc';
  }
}

function useCladdingTexture(cladding: CladdingType): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!cladding.startsWith('texture')) {
      setTex(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    const tryLoad = (ext: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(`/textures/${cladding}.${ext}`, resolve, undefined, reject);
      });

    (async () => {
      let loaded: THREE.Texture | null = null;
      for (const ext of ['jpeg', 'jpg', 'png']) {
        try {
          loaded = await tryLoad(ext);
          break;
        } catch {
          /* try next ext */
        }
      }
      if (cancelled) return;
      if (loaded) {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
        loaded.repeat.set(2, 3);
        setTex(loaded);
      } else {
        setTex(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cladding]);

  return tex;
}

function frameColorHex(c: FrameColor): string {
  switch (c) {
    case 'anthracite': return '#3a3f45';
    case 'blue': return '#2da6d2';
    case 'white': return '#e5e7eb';
  }
}

function lightColorHex(c: LightColor): string {
  switch (c) {
    case 'blue': return '#3b82f6';
    case 'white': return '#ffffff';
    case 'green': return '#22c55e';
    case 'purple': return '#a855f7';
    case 'rgb': return '#ff3b3b';
  }
}
