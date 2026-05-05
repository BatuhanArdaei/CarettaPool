'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PoolPreview from './PoolPreview';

interface Config {
  id: string;
  user_id: string | null;
  config: Record<string, unknown>;
  total_price: number;
  created_at: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

const CONFIG_LABELS: Record<string, Record<string, string>> = {
  frameColor:         { anthracite: 'Antrasit', blue: 'Mavi', white: 'Beyaz' },
  panel:              { glass: 'Cam', closed: 'Kapalı' },
  ground:             { gravel: 'Çakıl', wood: 'Tahta Deck', grass: 'Çimen', concrete: 'Beton' },
  cladding:           { white: 'Beyaz', blue_mosaic: 'Mavi Mozaik', gray_stone: 'Gri Taş', turquoise: 'Turkuaz' },
  platformDirection:  { north: 'Kuzey', south: 'Güney', east: 'Doğu', west: 'Batı' },
};

function configSummary(cfg: Record<string, unknown>) {
  const w = (cfg.width as number)?.toFixed(1) ?? '—';
  const l = (cfg.length as number)?.toFixed(1) ?? '—';
  const lighting = cfg.lighting as { enabled?: boolean; color?: string } | undefined;
  return [
    { label: 'Boyut',          value: `${w} × ${l} m` },
    { label: 'Çerçeve',        value: CONFIG_LABELS.frameColor[String(cfg.frameColor ?? '')] ?? String(cfg.frameColor ?? '') },
    { label: 'Panel',          value: CONFIG_LABELS.panel[String(cfg.panel ?? '')] ?? String(cfg.panel ?? '') },
    { label: 'Bölme Sayısı',   value: String(cfg.panelSegments ?? '') },
    { label: 'Zemin',          value: CONFIG_LABELS.ground[String(cfg.ground ?? '')] ?? String(cfg.ground ?? '') },
    { label: 'Kaplama',        value: CONFIG_LABELS.cladding[String(cfg.cladding ?? '')] ?? String(cfg.cladding ?? '') },
    { label: 'Işıklandırma',   value: lighting?.enabled ? `Açık (${(lighting.color ?? '').toUpperCase()})` : 'Kapalı' },
    { label: 'Şelale',         value: cfg.waterfall ? 'Var' : 'Yok' },
    { label: 'Platform Yönü',  value: CONFIG_LABELS.platformDirection[String(cfg.platformDirection ?? '')] ?? String(cfg.platformDirection ?? '') },
  ];
}

export default function TaleplerPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Config[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('pool_configs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Havuz Talepleri</h1>
        <p className="text-sm text-slate-500">Müşterilerin 3D konfigüratörden gönderdiği teklif talepleri.</p>
      </div>

      <div className="rounded-xl bg-white ring-1 ring-slate-200">
        {!rows.length ? (
          <p className="p-6 text-sm text-slate-500">Henüz teklif talebi yok.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => {
              const cfg = r.config ?? {};
              const w = (cfg.width as number)?.toFixed(1) ?? '—';
              const l = (cfg.length as number)?.toFixed(1) ?? '—';
              const isOpen = open === r.id;

              return (
                <div key={r.id}>
                  {/* Row header */}
                  <div className="flex items-center gap-4 p-4 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{w} × {l} m</p>
                      <p className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleString('tr-TR')} •{' '}
                        {r.user_id ? `Üye: ${r.user_id.slice(0, 8)}…` : 'Misafir'}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-brand-700 shrink-0">{fmt(r.total_price)}</span>
                    <button
                      onClick={() => setOpen(isOpen ? null : r.id)}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {isOpen ? 'Kapat ▲' : '3D Önizleme ▼'}
                    </button>
                  </div>

                  {/* Expanded detail with 3D preview */}
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50 p-5">
                      <div className="grid gap-6 lg:grid-cols-2">
                        {/* 3D Preview */}
                        <div>
                          <p className="mb-2 text-sm font-semibold text-slate-700">3D Model Önizlemesi</p>
                          <PoolPreview config={r.config} />
                        </div>

                        {/* Config details */}
                        <div>
                          <p className="mb-3 text-sm font-semibold text-slate-700">Seçilen Özellikler</p>
                          <dl className="space-y-2">
                            {configSummary(cfg).map(({ label, value }) => value && value !== '—' && (
                              <div key={label} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                                <dt className="text-slate-500">{label}</dt>
                                <dd className="font-medium text-slate-900">{value}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                            <span className="text-sm font-medium text-slate-700">Toplam Tutar</span>
                            <span className="text-xl font-bold text-brand-700">{fmt(r.total_price)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
