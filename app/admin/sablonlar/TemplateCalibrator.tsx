'use client';

import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import TemplateView, { useTemplateSolution } from '@/app/create/components/TemplateView';
import {
  POOL_TEMPLATES,
  type PoolTemplate,
  type TemplateCalibration,
  type TemplatePlacement,
  type TemplateSun,
} from '@/lib/pool/templates';
import { planeToWorld, projectToImage, type CameraSolution, type Vec2 } from '@/lib/pool/calibration';
import { defaultPoolConfig, type InstallationType, type PoolConfig } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span className="font-medium text-slate-900">
          {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand-500"
      />
    </label>
  );
}

/** Kenarı iki yönde uzatır: köşeleri karo derzlerine hizalamayı kolaylaştırır. */
function extendedEdge(a: Vec2, b: Vec2): [Vec2, Vec2] {
  const k = 4;
  return [
    [a[0] - (b[0] - a[0]) * k, a[1] - (b[1] - a[1]) * k],
    [b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k],
  ];
}

/** Zemine 1 m aralıklı ızgara (görüntüye oranla çizgi uçları). */
function groundGrid(
  solution: CameraSolution,
  template: PoolTemplate,
  center: TemplatePlacement,
): { a: Vec2; b: Vec2; major: boolean }[] {
  const lines: { a: Vec2; b: Vec2; major: boolean }[] = [];
  const R = 8;
  const toImg = (pa: number, pb: number) =>
    projectToImage(solution, template.aspect, planeToWorld(pa, pb, solution.planeSign));
  const ca = Math.round(center.centerA);
  const cb = Math.round(center.centerB);
  for (let i = -R; i <= R; i++) {
    const along = [toImg(ca + i, cb - R), toImg(ca + i, cb + R)];
    const across = [toImg(ca - R, cb + i), toImg(ca + R, cb + i)];
    if (along[0] && along[1]) lines.push({ a: along[0], b: along[1], major: i === 0 });
    if (across[0] && across[1]) lines.push({ a: across[0], b: across[1], major: i === 0 });
  }
  return lines;
}

export default function TemplateCalibrator() {
  const { t } = useLanguage();
  const [templateId, setTemplateId] = useState(POOL_TEMPLATES[0].id);
  const template = POOL_TEMPLATES.find((tp) => tp.id === templateId) ?? POOL_TEMPLATES[0];

  const stageRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [calib, setCalib] = useState<TemplateCalibration>(template.calibration);
  const [placement, setPlacement] = useState<TemplatePlacement>(template.placement);
  const [sun, setSun] = useState<TemplateSun>(template.sun);
  const [config, setConfig] = useState<PoolConfig>({ ...defaultPoolConfig, length: 6, showWater: true });
  const [night, setNight] = useState(false);
  const [calibrating, setCalibrating] = useState(true);
  const [showPool, setShowPool] = useState(true);
  const [copied, setCopied] = useState(false);

  const solution = useTemplateSolution(template, calib);
  const grid = useMemo(
    () => (solution && calibrating ? groundGrid(solution, template, placement) : []),
    [solution, calibrating, template, placement],
  );

  const selectTemplate = (id: string) => {
    const next = POOL_TEMPLATES.find((tp) => tp.id === id) ?? POOL_TEMPLATES[0];
    setTemplateId(next.id);
    setCalib(next.calibration);
    setPlacement(next.placement);
    setSun(next.sun);
  };

  // Sürüklenen nokta: 'level' kipinde 0 = kaçış noktası; 'rect' kipinde 0–3 = köşeler
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const index = dragIndex.current;
    const stage = stageRef.current;
    if (index === null || !stage) return;
    const box = stage.getBoundingClientRect();
    const p: Vec2 = [
      Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    ];
    setCalib((c) =>
      c.mode === 'level' ? { ...c, vp: p } : { ...c, points: c.points.map((q, i) => (i === index ? p : q)) },
    );
  }, []);

  const handles: Vec2[] = calib.mode === 'level' ? [calib.vp] : calib.points;
  const round = (n: number, d = 3) => Number(n.toFixed(d));

  const copySettings = async () => {
    const c =
      calib.mode === 'level'
        ? { ...calib, vp: calib.vp.map((v) => round(v)), height: round(calib.height, 2) }
        : { ...calib, points: calib.points.map(([x, y]) => [round(x, 4), round(y, 4)]) };
    const payload = {
      calibration: c,
      sun,
      placement: { centerA: round(placement.centerA, 2), centerB: round(placement.centerB, 2), rotation: placement.rotation },
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDown = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIndex.current = i;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div
        ref={stageRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200"
        style={{ aspectRatio: template.aspect }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragIndex.current = null)}
        onPointerLeave={() => (dragIndex.current = null)}
      >
        <TemplateView
          template={template}
          config={config}
          night={night}
          calibration={calib}
          placement={placement}
          sun={sun}
          showPool={showPool}
          fit="cover"
        >
          {calibrating && (
            <>
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                {grid.map((l, i) => (
                  <line
                    key={`g-${i}`}
                    x1={l.a[0]}
                    y1={l.a[1]}
                    x2={l.b[0]}
                    y2={l.b[1]}
                    stroke={l.major ? '#ff3d7f' : '#22d3ee'}
                    strokeOpacity={l.major ? 0.9 : 0.55}
                    strokeWidth={l.major ? 1.5 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {calib.mode === 'level' && (
                  <line x1={0} y1={calib.vp[1]} x2={1} y2={calib.vp[1]} stroke="#facc15" strokeDasharray="0.01 0.006" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                )}
                {calib.mode === 'rect' && (
                  <>
                    {calib.points.map((p, i) => {
                      const [a, b] = extendedEdge(p, calib.points[(i + 1) % 4]);
                      return (
                        <line key={`ext-${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ff3d7f" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      );
                    })}
                    <polygon
                      points={calib.points.map((p) => p.join(',')).join(' ')}
                      fill="rgba(6,182,212,0.15)"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                )}
              </svg>
              {handles.map(([x, y], i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={calib.mode === 'level' ? 'Kaçış noktası' : `Köşe ${i + 1}`}
                  onPointerDown={handleDown(i)}
                  className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-brand-500 p-0 text-xs font-bold text-white shadow-lg active:cursor-grabbing"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                >
                  {calib.mode === 'level' ? '✛' : i + 1}
                </button>
              ))}
            </>
          )}
          {!solution && (
            <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-red-600 px-4 py-2 text-sm text-white shadow">
              Bu ayarlardan kamera çözülemedi.
            </div>
          )}
        </TemplateView>
      </div>

      <aside className="card space-y-6 p-5">
        <label className="block">
          <span className="label">Şablon</span>
          <select className="input mt-1" value={templateId} onChange={(e) => selectTemplate(e.target.value)}>
            {POOL_TEMPLATES.map((tp) => (
              <option key={tp.id} value={tp.id}>{t(tp.nameKey)}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={() => setNight(false)} className={`flex-1 ${!night ? 'btn-primary' : 'btn-outline'}`}>Gündüz</button>
          <button type="button" onClick={() => setNight(true)} className={`flex-1 ${night ? 'btn-primary' : 'btn-outline'}`}>Gece</button>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Kalibrasyon</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={calibrating} onChange={(e) => setCalibrating(e.target.checked)} />
              Izgara
            </label>
          </div>
          {calib.mode === 'level' ? (
            <>
              <p className="text-xs text-slate-500">
                ✛ noktasını zemin çizgilerinin birleştiği yere taşıyın (sarı çizgi = ufuk). Yüksekliği, ızgaranın yanal
                aralıkları karo genişliğine; lensi, derinlik aralıkları karo boyuna uyana kadar ayarlayın.
              </p>
              <Slider label="Kamera yüksekliği" value={calib.height} min={1.5} max={8} step={0.05} unit=" m" onChange={(v) => setCalib((c) => (c.mode === 'level' ? { ...c, height: v } : c))} />
              <Slider label="Lens (35 mm eşdeğer)" value={calib.focal35} min={14} max={50} step={0.5} unit=" mm" onChange={(v) => setCalib((c) => (c.mode === 'level' ? { ...c, focal35: v } : c))} />
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">1→2→3→4 köşelerini zemindeki gerçek bir dikdörtgene hizalayın ve ölçüsünü girin.</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label>
                  <span className="text-slate-600">1→2 (m)</span>
                  <input type="number" step={0.1} min={0.1} value={calib.width} className="input mt-1"
                    onChange={(e) => setCalib((c) => (c.mode === 'rect' ? { ...c, width: Number(e.target.value) || c.width } : c))} />
                </label>
                <label>
                  <span className="text-slate-600">2→3 (m)</span>
                  <input type="number" step={0.1} min={0.1} value={calib.depth} className="input mt-1"
                    onChange={(e) => setCalib((c) => (c.mode === 'rect' ? { ...c, depth: Number(e.target.value) || c.depth } : c))} />
                </label>
              </div>
            </>
          )}
          {solution && (
            <p className="rounded bg-slate-100 p-2 text-xs text-slate-600">
              Kamera yüksekliği: {solution.height.toFixed(2)} m · Odak: {solution.focalPx.toFixed(0)}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Havuz yerleşimi</h2>
          <Slider label="Yanal konum" value={placement.centerA} min={-15} max={15} step={0.05} unit=" m" onChange={(v) => setPlacement((p) => ({ ...p, centerA: v }))} />
          <Slider label="Uzaklık" value={placement.centerB} min={-5} max={30} step={0.05} unit=" m" onChange={(v) => setPlacement((p) => ({ ...p, centerB: v }))} />
          <Slider label="Döndürme" value={placement.rotation} min={-180} max={180} step={1} unit="°" onChange={(v) => setPlacement((p) => ({ ...p, rotation: v }))} />
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Önizleme havuzu</h2>
          <Slider label="Uzunluk" value={config.width} min={4} max={13} step={0.5} unit=" m" onChange={(v) => setConfig((c) => ({ ...c, width: v }))} />
          <Slider label="Genişlik" value={config.length} min={2.3} max={4} step={0.1} unit=" m" onChange={(v) => setConfig((c) => ({ ...c, length: v }))} />
          <label className="block">
            <span className="text-sm text-slate-600">Kurulum</span>
            <select className="input mt-1" value={config.installation}
              onChange={(e) => setConfig((c) => ({ ...c, installation: e.target.value as InstallationType }))}>
              <option value="ground">Yerüstü</option>
              <option value="partial">Yarı gömülü</option>
              <option value="sunken">Tam gömülü</option>
            </select>
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Güneş (gündüz)</h2>
          <Slider label="Yön" value={sun.azimuth} min={-180} max={180} step={1} unit="°" onChange={(v) => setSun((s) => ({ ...s, azimuth: v }))} />
          <Slider label="Yükseklik" value={sun.elevation} min={5} max={80} step={1} unit="°" onChange={(v) => setSun((s) => ({ ...s, elevation: v }))} />
          <Slider label="Şiddet" value={sun.intensity} min={0.5} max={5} step={0.1} onChange={(v) => setSun((s) => ({ ...s, intensity: v }))} />
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={() => setShowPool((v) => !v)} className="btn-outline w-full">
            {showPool ? 'Havuzu gizle (öncesi)' : 'Havuzu göster'}
          </button>
          <button type="button" onClick={copySettings} className="btn-primary w-full">
            {copied ? 'Kopyalandı' : 'Ayarları kopyala'}
          </button>
          <p className="text-xs text-slate-500">
            Kopyalanan değerler <code>lib/pool/templates.ts</code> içindeki şablona yapıştırılır.
          </p>
        </section>
      </aside>
    </div>
  );
}
