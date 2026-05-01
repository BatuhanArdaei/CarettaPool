'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
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

export default function PoolScene({ config }: { config: PoolConfig }) {
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
            <ambientLight intensity={0.55} />
            <directionalLight
              position={[15, 20, 10]}
              intensity={1.1}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
          </>
        )}
        <Garden ground={config.ground} isNight={isNight} />
        <Trees isNight={isNight} />
        <Villa isNight={isNight} />
        <Fence isNight={isNight} />
        <Pool config={config} />
        <OrbitControls
          enablePan={false}
          enableZoom
          enableRotate
          minDistance={4}
          maxDistance={22}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, POOL_HEIGHT / 2, 0]}
        />
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
      [10, 0, -11],
      [-13, 0, 9],
      [13, 0, 10],
      [-8, 0, -14],
      [8, 0, 13],
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

function Villa({ isNight }: { isNight: boolean }) {
  const wall = isNight ? '#a89a82' : '#f0e6d2';
  const trim = isNight ? '#5a4630' : '#8a6a44';
  const roof = isNight ? '#5a2818' : '#a04428';
  const windowMat = isNight ? '#1a2438' : '#7eb3d6';
  const door = isNight ? '#2a1a0c' : '#4a2e16';

  // Villa is positioned in a far corner of the garden, rotated to face the pool.
  return (
    <group position={[-12, 0, -11]} rotation={[0, Math.PI / 4, 0]}>
      {/* Main body */}
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 3.2, 4.2]} />
        <meshStandardMaterial color={wall} />
      </mesh>

      {/* Roof — pyramid (cone with 4 sides) */}
      <mesh position={[0, 3.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.9, 1.5, 4]} />
        <meshStandardMaterial color={roof} />
      </mesh>

      {/* Door */}
      <mesh position={[0, 0.9, 2.11]} castShadow>
        <boxGeometry args={[0.95, 1.85, 0.05]} />
        <meshStandardMaterial color={door} />
      </mesh>

      {/* Windows on the front facade */}
      {[[-1.7, 1.8], [1.7, 1.8]].map(([x, y], i) => (
        <mesh key={`fw-${i}`} position={[x, y, 2.11]}>
          <boxGeometry args={[0.95, 0.95, 0.05]} />
          <meshStandardMaterial
            color={windowMat}
            emissive={isNight ? '#f4c673' : '#000000'}
            emissiveIntensity={isNight ? 0.55 : 0}
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Window on side */}
      <mesh position={[-2.78, 1.8, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[1.6, 0.9, 0.05]} />
        <meshStandardMaterial
          color={windowMat}
          emissive={isNight ? '#f4c673' : '#000000'}
          emissiveIntensity={isNight ? 0.55 : 0}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>

      {/* Trim above door */}
      <mesh position={[0, 1.95, 2.13]}>
        <boxGeometry args={[1.2, 0.12, 0.06]} />
        <meshStandardMaterial color={trim} />
      </mesh>

      {/* Front porch step */}
      <mesh position={[0, 0.05, 2.6]} receiveShadow>
        <boxGeometry args={[2, 0.1, 0.8]} />
        <meshStandardMaterial color="#cfd1d4" />
      </mesh>

      {/* Warm porch light at night */}
      {isNight && (
        <pointLight
          position={[0, 2.2, 2.4]}
          color="#ffd6a0"
          intensity={1.2}
          distance={6}
          decay={1.8}
        />
      )}
    </group>
  );
}

function Fence({ isNight }: { isNight: boolean }) {
  const wood = isNight ? '#3a2818' : '#6b4628';
  const fenceHalfX = 16;
  const fenceHalfZ = 16;
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
          color={wood}
          isNight={isNight}
        />
      ))}
    </group>
  );
}

function FenceSegment({
  from,
  to,
  color,
  isNight,
}: {
  from: [number, number];
  to: [number, number];
  color: string;
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

  const postH = 1.05;
  const postSize: [number, number, number] = [0.09, postH, 0.09];
  const spacing = 1.6;
  const numIntervals = Math.max(1, Math.round(length / spacing));
  const posts: number[] = [];
  for (let i = 0; i <= numIntervals; i++) {
    posts.push((i / numIntervals) * length - length / 2);
  }
  const railYs = [0.3, 0.7];
  const railColor = isNight ? '#2a1d10' : '#7a5230';

  return (
    <group position={[cx, 0, cz]} rotation={[0, -angle, 0]}>
      {posts.map((u, i) => (
        <mesh key={`p${i}`} position={[u, postH / 2, 0]} castShadow>
          <boxGeometry args={postSize} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {railYs.map((y, i) => (
        <mesh key={`r${i}`} position={[0, y, 0]} castShadow>
          <boxGeometry args={[length, 0.07, 0.04]} />
          <meshStandardMaterial color={railColor} />
        </mesh>
      ))}
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
      {config.waterfall && (
        <Waterfall halfL={halfL} top={top} waterY={waterY} />
      )}

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
  // A real pool ladder: two parallel rails + 5 horizontal rungs.
  const railSpacing = 0.46;     // distance between the two rails
  const railR = 0.028;          // rail radius
  const rungR = 0.022;          // rung radius
  const inset = PANEL_T + 0.28; // distance inside the pool from the wall
  const handrailTopY = top + 0.85;     // rails extend ~85 cm above coping
  const railBottomY = waterY - 0.85;   // rails extend ~85 cm below water surface
  const railLen = handrailTopY - railBottomY;
  const railYMid = (handrailTopY + railBottomY) / 2;
  const numRungs = 5;
  const rungYBottom = waterY - 0.5;
  const rungYTop = top - 0.18;

  // Determine ladder anchor and the axis along which rungs run.
  let baseX = 0;
  let baseZ = 0;
  let rungAxis: 'x' | 'z' = 'z';

  if (platformDirection === 'east') {
    baseX = halfW - inset;
    rungAxis = 'z';
  } else if (platformDirection === 'west') {
    baseX = -halfW + inset;
    rungAxis = 'z';
  } else if (platformDirection === 'north') {
    baseZ = -halfL + inset;
    rungAxis = 'x';
  } else {
    baseZ = halfL - inset;
    rungAxis = 'x';
  }

  const offsets = [-railSpacing / 2, railSpacing / 2];
  const chrome = '#f5f5f5';

  return (
    <group>
      {/* Two vertical rails */}
      {offsets.map((off, i) => {
        const x = baseX + (rungAxis === 'z' ? 0 : off);
        const z = baseZ + (rungAxis === 'z' ? off : 0);
        return (
          <group key={`rail-${i}`}>
            <mesh position={[x, railYMid, z]} castShadow>
              <cylinderGeometry args={[railR, railR, railLen, 12]} />
              <meshStandardMaterial color={chrome} metalness={0.4} roughness={0.4} />
            </mesh>
            {/* Rounded top cap */}
            <mesh position={[x, handrailTopY, z]} castShadow>
              <sphereGeometry args={[railR * 1.15, 12, 8]} />
              <meshStandardMaterial color={chrome} metalness={0.4} roughness={0.4} />
            </mesh>
          </group>
        );
      })}

      {/* Horizontal rungs */}
      {Array.from({ length: numRungs }, (_, i) => {
        const t = numRungs === 1 ? 0.5 : i / (numRungs - 1);
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
  waterY,
}: {
  halfL: number;
  top: number;
  waterY: number;
}) {
  // Stainless steel cascade: flat vertical plate post + half-torus arch
  // curving over into the pool with a falling water sheet.
  const archR = 0.32;
  const tubeR = 0.07;
  const postH = 0.7;

  // Flat plate-like post (wide, thin) sitting on the coping
  const postW = 0.36;
  const postT = 0.05;

  const postZ = -halfL + 0.12;
  const postY = top + postH / 2;
  const postTopY = top + postH;

  const arcCenterZ = postZ + archR;
  const arcEndZ = postZ + 2 * archR;

  const sheetWidth = 0.36;
  const sheetTopY = postTopY - 0.08;
  const sheetBotY = waterY + 0.02;
  const sheetH = sheetTopY - sheetBotY;

  // Brushed-steel look that doesn't depend on env map (metalness kept low)
  const steelMatProps = {
    color: '#d8dde4',
    metalness: 0.25,
    roughness: 0.45,
    emissive: '#1a1f24',
    emissiveIntensity: 0.05,
  };

  return (
    <group>
      {/* Flat vertical plate post */}
      <mesh position={[0, postY, postZ]} castShadow>
        <boxGeometry args={[postW, postH, postT]} />
        <meshStandardMaterial {...steelMatProps} />
      </mesh>

      {/* Side rims giving the plate a slight U-channel look */}
      <mesh
        position={[postW / 2 - 0.012, postY, postZ + 0.025]}
        castShadow
      >
        <boxGeometry args={[0.025, postH, 0.06]} />
        <meshStandardMaterial {...steelMatProps} />
      </mesh>
      <mesh
        position={[-postW / 2 + 0.012, postY, postZ + 0.025]}
        castShadow
      >
        <boxGeometry args={[0.025, postH, 0.06]} />
        <meshStandardMaterial {...steelMatProps} />
      </mesh>

      {/* Half-torus arch (in YZ plane) */}
      <mesh
        position={[0, postTopY, arcCenterZ]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      >
        <torusGeometry args={[archR, tubeR, 16, 32, Math.PI]} />
        <meshStandardMaterial {...steelMatProps} />
      </mesh>

      {/* Wider scoop opening at the arch end */}
      <mesh
        position={[0, postTopY, arcEndZ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[tubeR * 0.35, tubeR * 1.1, 20]} />
        <meshStandardMaterial
          {...steelMatProps}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Water sheet falling from the arch end */}
      <mesh position={[0, (sheetTopY + sheetBotY) / 2, arcEndZ]}>
        <planeGeometry args={[sheetWidth, sheetH]} />
        <meshStandardMaterial
          color="#a4daee"
          transparent
          opacity={0.55}
          roughness={0.05}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Splash ring at the water surface */}
      <mesh
        position={[0, waterY + 0.012, arcEndZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.08, 0.22, 24]} />
        <meshStandardMaterial
          color="#d4ecf6"
          transparent
          opacity={0.7}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
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
