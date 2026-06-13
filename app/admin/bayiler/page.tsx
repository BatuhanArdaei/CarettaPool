'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PRICES } from '@/lib/pricing';

/* ─── Per-dealer overrideable price items ───────────────────────── */
const PRICE_ITEMS = [
  { key: 'base_per_sqm',         label: 'Taban Fiyat (m²)',              default: DEFAULT_PRICES.base_per_sqm },
  { key: 'frame_blue',           label: 'Çerçeve – Mavi',                default: DEFAULT_PRICES.frame_blue },
  { key: 'frame_white',          label: 'Çerçeve – Beyaz',               default: DEFAULT_PRICES.frame_white },
  { key: 'panel_glass',          label: 'Cam Panel (segment başı)',       default: DEFAULT_PRICES.panel_glass },
  { key: 'ground_wood',          label: 'Zemin – Tahta Deck',            default: DEFAULT_PRICES.ground_wood },
  { key: 'ground_grass',         label: 'Zemin – Çimen',                 default: DEFAULT_PRICES.ground_grass },
  { key: 'ground_concrete',      label: 'Zemin – Beton',                 default: DEFAULT_PRICES.ground_concrete },
  { key: 'cladding_blue_mosaic', label: 'Kaplama – Mavi Mozaik',         default: DEFAULT_PRICES.cladding_blue_mosaic },
  { key: 'cladding_gray_stone',  label: 'Kaplama – Gri Taş',             default: DEFAULT_PRICES.cladding_gray_stone },
  { key: 'cladding_turquoise',   label: 'Kaplama – Turkuaz',             default: DEFAULT_PRICES.cladding_turquoise },
  { key: 'cladding_texture',     label: 'Kaplama – Doku (tüm desenler)', default: DEFAULT_PRICES.cladding_texture },
  { key: 'lighting',             label: 'Işıklandırma',                  default: DEFAULT_PRICES.lighting },
  { key: 'waterfall',            label: 'Şelale',                        default: DEFAULT_PRICES.waterfall },
  { key: 'platform',             label: 'Yan Platform',                   default: DEFAULT_PRICES.platform },
];

interface Dealer {
  id: string;
  user_id: string;
  company_name: string;
  discount_rate: number;
  is_active: boolean;
  discount_type: 'percentage' | 'custom';
  custom_prices: Record<string, number>;
}

function CustomPriceEditor({
  dealer,
  onSave,
}: {
  dealer: Dealer;
  onSave: (prices: Record<string, number>) => Promise<void>;
}) {
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    PRICE_ITEMS.forEach(item => {
      init[item.key] = dealer.custom_prices[item.key] ?? item.default;
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function apply() {
    setSaving(true);
    await onSave(prices);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">
        Kalem bazında özel fiyat — düzenledikten sonra <strong>Uygula</strong>'ya basın.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PRICE_ITEMS.map(item => (
          <div key={item.key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{item.label}</p>
              <p className="text-[11px] text-slate-400">
                Standart: {item.default.toLocaleString('tr-TR')} TL
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <input
                type="number" inputMode="decimal"
                min={0}
                step={100}
                value={prices[item.key]}
                onChange={e => setPrices(p => ({ ...p, [item.key]: Number(e.target.value) }))}
                className="input w-24 text-sm"
              />
              <span className="text-xs text-slate-500">TL</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={apply}
          disabled={saving}
          className="btn-primary px-6"
        >
          {saving ? 'Kaydediliyor…' : 'Uygula'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Kaydedildi</span>}
      </div>
    </div>
  );
}

export default function AdminBayiler() {
  const supabase = createClient();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPw, setEditPw] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '', email: '', password: '', full_name: '',
    discount_type: 'percentage' as 'percentage' | 'custom',
    discount_rate: 0,
    custom_prices: {} as Record<string, number>,
  });
  const [formCustomPrices, setFormCustomPrices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    PRICE_ITEMS.forEach(i => { init[i.key] = i.default; });
    return init;
  });

  async function load() {
    const { data } = await supabase.from('dealers').select('*').order('company_name');
    setDealers((data ?? []).map(d => ({
      ...d,
      is_active: d.is_active ?? true,
      discount_type: d.discount_type ?? 'percentage',
      custom_prices: d.custom_prices ?? {},
    })));
  }
  useEffect(() => { load(); }, []);

  async function addDealer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/admin/create-dealer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, custom_prices: form.discount_type === 'custom' ? formCustomPrices : {} }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setMsg('Bayi oluşturuldu!');
      setForm({ company_name: '', email: '', password: '', full_name: '', discount_type: 'percentage', discount_rate: 0, custom_prices: {} });
      const init: Record<string, number> = {};
      PRICE_ITEMS.forEach(i => { init[i.key] = i.default; });
      setFormCustomPrices(init);
      setShowForm(false); load();
    } catch (err) { setMsg((err as Error).message); }
    setSaving(false);
  }

  async function toggleActive(d: Dealer) {
    const next = !d.is_active;
    await supabase.from('dealers').update({ is_active: next }).eq('id', d.id);
    await fetch('/api/admin/update-user', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: d.user_id, ban: !next }),
    });
    load();
  }

  async function saveRate(d: Dealer, rate: number) {
    await supabase.from('dealers').update({ discount_rate: rate }).eq('id', d.id);
    load();
  }

  async function saveDiscountType(d: Dealer, type: 'percentage' | 'custom') {
    await supabase.from('dealers').update({ discount_type: type }).eq('id', d.id);
    load();
  }

  async function saveCustomPrice(d: Dealer, key: string, value: number) {
    const next = { ...d.custom_prices, [key]: value };
    await supabase.from('dealers').update({ custom_prices: next }).eq('id', d.id);
    load();
  }

  async function changePassword(userId: string) {
    if (!newPw.trim()) return;
    const res = await fetch('/api/admin/update-user', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, password: newPw }),
    });
    const json = await res.json();
    setMsg(res.ok ? 'Şifre güncellendi' : (json.error ?? 'Hata'));
    setEditPw(null); setNewPw('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bayi Yönetimi</h1>
          <p className="text-sm text-slate-500">Bayi hesapları, indirim türleri ve erişim kontrolü.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">+ Yeni Bayi Kaydı</button>
      </div>

      {msg && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{msg}</p>}

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl bg-white p-6 ring-1 ring-brand-200">
          <h2 className="mb-4 font-semibold text-slate-900">Yeni Bayi Ekle</h2>
          <form onSubmit={addDealer} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Firma Adı</label>
                <input className="input" required value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} /></div>
              <div><label className="label">Yetkili Adı</label>
                <input className="input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} /></div>
              <div><label className="label">E-posta</label>
                <input type="email" className="input" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="label">Şifre</label>
                <input type="password" className="input" minLength={6} required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
            </div>

            {/* Discount type */}
            <div>
              <label className="label">İndirim Türü</label>
              <div className="flex rounded-lg bg-slate-100 p-1 w-fit">
                {(['percentage', 'custom'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(p => ({ ...p, discount_type: t }))}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition ${form.discount_type === t ? 'bg-white shadow' : 'text-slate-600'}`}>
                    {t === 'percentage' ? 'Yüzdelik İndirim' : 'Özel Fiyatlar'}
                  </button>
                ))}
              </div>
            </div>

            {form.discount_type === 'percentage' && (
              <div className="max-w-xs">
                <label className="label">İndirim Oranı (%)</label>
                <input type="number" inputMode="decimal" className="input" min={0} max={100} step={0.5}
                  value={form.discount_rate}
                  onChange={e => setForm(p => ({ ...p, discount_rate: Number(e.target.value) }))} />
              </div>
            )}

            {form.discount_type === 'custom' && (
              <div>
                <p className="mb-3 text-sm text-slate-600">Özel fiyatları girin (boş bırakırsan standart uygulanır):</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PRICE_ITEMS.map(item => (
                    <div key={item.key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{item.label}</p>
                        <p className="text-[11px] text-slate-400">Standart: {item.default.toLocaleString('tr-TR')} TL</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <input type="number" inputMode="decimal" min={0} step={100}
                          value={formCustomPrices[item.key] ?? item.default}
                          onChange={e => setFormCustomPrices(p => ({ ...p, [item.key]: Number(e.target.value) }))}
                          className="input w-24 text-sm" />
                        <span className="text-xs text-slate-500">TL</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary px-8" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline">İptal</button>
            </div>
          </form>
        </div>
      )}

      {/* Dealer list */}
      <div className="space-y-4">
        {!dealers.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">Kayıtlı bayi yok.</p>}
        {dealers.map(d => (
          <div key={d.id} className={`rounded-xl bg-white ring-1 ${d.is_active ? 'ring-slate-200' : 'ring-red-200 opacity-75'}`}>
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-3 p-5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{d.company_name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {d.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">ID: {d.user_id.slice(0, 14)}…</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  {expandedId === d.id ? 'Kapat' : 'Düzenle'}
                </button>

                {editPw === d.id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="password" placeholder="Yeni şifre" minLength={6} value={newPw}
                      onChange={e => setNewPw(e.target.value)} className="input w-32 text-xs" />
                    <button onClick={() => changePassword(d.user_id)}
                      className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-400">Kaydet</button>
                    <button onClick={() => { setEditPw(null); setNewPw(''); }} className="text-xs text-slate-400 hover:text-slate-700">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setEditPw(d.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Şifre Değiştir
                  </button>
                )}

                <button onClick={() => toggleActive(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${d.is_active
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                  {d.is_active ? 'Pasife Al' : 'Aktif Et'}
                </button>
              </div>
            </div>

            {/* Expanded discount editor */}
            {expandedId === d.id && (
              <div className="border-t border-slate-100 p-5 space-y-5">
                {/* Discount type toggle */}
                <div>
                  <p className="label mb-2">İndirim Türü</p>
                  <div className="flex rounded-lg bg-slate-100 p-1 w-fit">
                    {(['percentage', 'custom'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => saveDiscountType(d, t)}
                        className={`rounded-md px-4 py-2 text-sm font-medium transition ${d.discount_type === t ? 'bg-white shadow' : 'text-slate-600'}`}>
                        {t === 'percentage' ? 'Yüzdelik İndirim' : 'Özel Fiyatlar'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Percentage mode */}
                {d.discount_type === 'percentage' && (
                  <div className="max-w-xs">
                    <label className="label">Genel İndirim Oranı (%)</label>
                    <div className="flex gap-2">
                      <input type="number" inputMode="decimal" min={0} max={100} step={0.5}
                        defaultValue={d.discount_rate} key={d.discount_rate}
                        onBlur={e => saveRate(d, Number(e.target.value))}
                        className="input w-32" />
                      <span className="flex items-center text-sm text-slate-500">tüm kalemlere uygulanır</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Toplam fiyata bu oran kadar indirim yapılır.</p>
                  </div>
                )}

                {/* Custom price mode */}
                {d.discount_type === 'custom' && (
                  <CustomPriceEditor dealer={d} onSave={async (prices) => {
                    await supabase.from('dealers').update({ custom_prices: prices }).eq('id', d.id);
                    load();
                    setMsg('Özel fiyatlar kaydedildi.');
                  }} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
