'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Row {
  id: string;
  user_id: string | null;
  config: Record<string, unknown>;
  total_price: number;
  created_at: string;
  dealer_name?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function BayiTalepleriPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // dealer users
      const { data: dealers } = await supabase.from('dealers').select('user_id, company_name');
      const dealerMap = Object.fromEntries((dealers ?? []).map(d => [d.user_id, d.company_name]));
      const dealerIds = Object.keys(dealerMap);

      if (!dealerIds.length) { setRows([]); return; }

      const { data: configs } = await supabase
        .from('pool_configs')
        .select('*')
        .in('user_id', dealerIds)
        .order('created_at', { ascending: false });

      setRows((configs ?? []).map(r => ({ ...r, dealer_name: dealerMap[r.user_id ?? ''] ?? '—' })));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bayi Talepleri</h1>
        <p className="text-sm text-slate-500">Yalnızca kayıtlı bayilerin gönderdiği havuz konfigürasyon talepleri.</p>
      </div>

      <div className="rounded-xl bg-white ring-1 ring-slate-200">
        {!rows.length ? (
          <p className="p-6 text-sm text-slate-500">Henüz bayi talebi yok.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Bayi</th>
                <th className="px-5 py-3">Tarih</th>
                <th className="px-5 py-3">Boyut</th>
                <th className="px-5 py-3 text-right">Toplam</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => {
                const cfg = r.config ?? {};
                const w = (cfg.width as number)?.toFixed(1) ?? '—';
                const l = (cfg.length as number)?.toFixed(1) ?? '—';
                return (
                  <>
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{r.dealer_name}</td>
                      <td className="px-5 py-3 text-slate-600">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
                      <td className="px-5 py-3">{w} × {l} m</td>
                      <td className="px-5 py-3 text-right font-bold text-brand-700">{fmt(r.total_price)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setOpen(open === r.id ? null : r.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          {open === r.id ? 'Gizle' : 'Detay'}
                        </button>
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr key={r.id + '-d'}>
                        <td colSpan={5} className="bg-slate-50 px-5 py-4">
                          <div className="grid gap-2 sm:grid-cols-3 text-xs">
                            {Object.entries(cfg).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="font-medium text-slate-500 capitalize">{k}:</span>
                                <span className="text-slate-700">{JSON.stringify(v)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
