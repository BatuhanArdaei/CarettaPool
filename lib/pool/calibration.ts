export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type CameraSolution = {
  /** Kamera konumu (three.js dünya koordinatı, metre, Y yukarı) */
  position: Vec3;
  /** Kameranın dünya eksenleri (three.js kamerası: x sağ, y yukarı, z geriye) */
  basis: { x: Vec3; y: Vec3; z: Vec3 };
  /** Dikey görüş açısı (derece) — ana nokta görüntü merkezindeyken */
  fov: number;
  /** Odak uzaklığı; görüntü yüksekliği 1000 birim kabul edilerek */
  focalPx: number;
  /** Zeminden kamera yüksekliği (metre) */
  height: number;
  /** Kalibrasyon dörtgeninin düzlem koordinatlarından (a, b) dünya koordinatına dönüşüm işareti */
  planeSign: 1 | -1;
  /** Ana nokta (görüntüye oranla 0–1). Yoksa görüntü merkezi. Lens kaydırmalı çekimlerde merkez dışıdır. */
  principal?: Vec2;
};

/** 35 mm eşdeğer lens (mm) → odak uzaklığı (görüntü yüksekliği 1000 birim). */
export function focalFrom35mm(focal35: number, aspect: number): number {
  return (1000 * aspect * focal35) / 36;
}

/**
 * Mimari fotoğraf tarzı "yatay kamera": kamera yere paraleldir, dik çizgiler paralel kalır ve
 * zemindeki derinlik çizgilerinin kaçış noktası ana noktadır (lens kaydırmalı çekim).
 * Üç sezgisel değerle tanımlanır: kaçış noktası (ufuk), lens ve kamera yüksekliği.
 * Zemin düzleminde a = yanal (sağ), b = kameradan uzaklık (metre).
 */
export function levelCamera(
  params: { vp: Vec2; focal35: number; height: number },
  aspect: number,
): CameraSolution {
  const focalPx = focalFrom35mm(params.focal35, aspect);
  return {
    position: [0, params.height, 0],
    basis: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    fov: (2 * Math.atan(500 / focalPx) * 180) / Math.PI,
    focalPx,
    height: params.height,
    planeSign: 1,
    principal: params.vp,
  };
}

/** Dünya noktasını görüntüye oranla (0–1) koordinata izdüşürür; kameranın arkasındaysa null. */
export function projectToImage(solution: CameraSolution, aspect: number, point: Vec3): Vec2 | null {
  const d: Vec3 = [
    point[0] - solution.position[0],
    point[1] - solution.position[1],
    point[2] - solution.position[2],
  ];
  const dotB = (b: Vec3) => d[0] * b[0] + d[1] * b[1] + d[2] * b[2];
  const cx = dotB(solution.basis.x);
  const cy = dotB(solution.basis.y);
  const cz = dotB(solution.basis.z);
  if (cz > -0.05) return null;
  const [pu, pv] = solution.principal ?? [0.5, 0.5];
  return [pu + (solution.focalPx * cx) / -cz / (1000 * aspect), pv - (solution.focalPx * cy) / -cz / 1000];
}

/** Kalibrasyon düzlemindeki (a, b) noktasını three.js dünya koordinatına çevirir. */
export function planeToWorld(a: number, b: number, planeSign: 1 | -1): Vec3 {
  return [a, 0, -planeSign * b];
}

/** 4 nokta eşlemesinden 3x3 homografi (satır bazlı, h33 = 1). */
export function solveHomography(src: Vec2[], dst: Vec2[]): number[] | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  // Kısmi pivotlu Gauss eliminasyonu
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const k = A[r][col] / A[col][col];
      for (let c = col; c < 9; c++) A[r][c] -= k * A[col][c];
    }
  }

  const h = A.map((row, i) => row[8] / row[i]);
  return [...h, 1];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3) => Math.sqrt(dot(a, a));
const normalize = (a: Vec3) => scale(a, 1 / length(a));

/**
 * Zemindeki bilinen ölçülü bir dikdörtgenin görüntüdeki 4 köşesinden kamerayı çözer.
 * Köşe sırası: (0,0) → (width,0) → (width,depth) → (0,depth).
 * Ana nokta görüntü merkezi, pikseller kare kabul edilir; odak uzaklığı homografiden bulunur.
 */
export function calibrateFromRect(
  imagePoints: Vec2[],
  imageSize: { width: number; height: number },
  rect: { width: number; depth: number },
  /** Biliniyorsa odak uzaklığı (imageSize birimlerinde); verilirse homografiden tahmin edilmez */
  fixedFocalPx?: number,
): CameraSolution | null {
  const planePoints: Vec2[] = [
    [0, 0],
    [rect.width, 0],
    [rect.width, rect.depth],
    [0, rect.depth],
  ];
  const H = solveHomography(planePoints, imagePoints);
  if (!H) return null;

  const cx = imageSize.width / 2;
  const cy = imageSize.height / 2;
  const col = (j: number): Vec3 => [H[j], H[3 + j], H[6 + j]];
  const [h1, h2, h3] = [col(0), col(1), col(2)];

  // Ana noktayı çıkar: p = (hx - cx*hz, hy - cy*hz)
  const p: Vec2 = [h1[0] - cx * h1[2], h1[1] - cy * h1[2]];
  const q: Vec2 = [h2[0] - cx * h2[2], h2[1] - cy * h2[2]];

  // r1 ⊥ r2 ve |r1| = |r2| kısıtlarından 1/f² için en küçük kareler
  const eqs: Vec2[] = [
    [p[0] * q[0] + p[1] * q[1], h1[2] * h2[2]],
    [p[0] ** 2 + p[1] ** 2 - q[0] ** 2 - q[1] ** 2, h1[2] ** 2 - h2[2] ** 2],
  ];
  const num = eqs.reduce((s, [a, b]) => s + a * b, 0);
  const den = eqs.reduce((s, [a]) => s + a * a, 0);
  const invF2 = fixedFocalPx ? 1 / fixedFocalPx ** 2 : -num / den;
  if (!(invF2 > 0)) return null;
  const f = 1 / Math.sqrt(invF2);

  const kInv = (h: Vec3): Vec3 => [(h[0] - cx * h[2]) / f, (h[1] - cy * h[2]) / f, h[2]];
  const k1 = kInv(h1);
  const k2 = kInv(h2);
  let lambda = 2 / (length(k1) + length(k2));
  let t = scale(kInv(h3), lambda);
  if (t[2] < 0) {
    lambda = -lambda;
    t = scale(t, -1);
  }

  // Gram-Schmidt ile dik rotasyon matrisi R = [r1 r2 r3] (dünya → kamera, OpenCV ekseni)
  const r1 = normalize(scale(k1, lambda));
  let r2 = scale(k2, lambda);
  r2 = normalize(sub(r2, scale(r1, dot(r2, r1))));
  const r3 = cross(r1, r2);

  const row = (i: number): Vec3 => [r1[i], r2[i], r3[i]];
  // Kamera merkezi C = -Rᵀ t
  const C: Vec3 = [-dot(r1, t), -dot(r2, t), -dot(r3, t)];
  const planeSign: 1 | -1 = C[2] > 0 ? 1 : -1;

  // OpenCV dünyası (a, b, normal) → three.js (x, y yukarı, z)
  const toThree = (v: Vec3): Vec3 => [v[0], planeSign * v[2], -planeSign * v[1]];

  return {
    position: toThree(C),
    basis: {
      x: toThree(row(0)),
      y: toThree(scale(row(1), -1)),
      z: toThree(scale(row(2), -1)),
    },
    fov: (2 * Math.atan(imageSize.height / 2 / f) * 180) / Math.PI,
    focalPx: f,
    height: Math.abs(C[2]),
    planeSign,
  };
}
