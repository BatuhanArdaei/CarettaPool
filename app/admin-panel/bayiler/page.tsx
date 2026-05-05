'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Dealer { id: string; company_name: string; discount_rate: number; }

export default function AdminBayiler() {
  const supabase = createClient();
  const [dealers, setDealers] = useState<Dealer[]>([]);

  async function load() {
    const { data } = await supabase.from('dealers').select('*').order('company_name');
    setDealers(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function updateRate(id: string, rate: number) {
    await supabase.from('dealers').update({ discount_rate: rate }).eq('id', id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Bayi Yönetimi</h1>
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        {!dealers.length ? <p className="text-sm text-slate-500">Kayıtlı bayi yok.</p> : (
          <div className="space-y-3">
            {dealers.map(d => (
              <div key={d.id} className="flex flex-wrap items-center gap-4 rounded-lg p-4 ring-1 ring-slate-200">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{d.company_name}</p>
                  <p className="text-xs text-slate-500">{d.id.slice(0, 8)}…</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">İndirim %</label>
                  <input type="number" min="0" max="100" step="0.1" defaultValue={d.discount_rate}
                    onBlur={e => updateRate(d.id, Number(e.target.value))}
                    className="input w-24" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
