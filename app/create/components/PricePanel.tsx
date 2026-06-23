'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatTRY, type PriceBreakdown } from '@/lib/pricing';
import { countPanels, segmentsForSide, POOL_SIDES, type PoolConfig } from '@/lib/types';

interface Props {
  config: PoolConfig;
  breakdown: PriceBreakdown;
  isDealer: boolean;
  discountRate: number;
  loading: boolean;
  error: string | null;
  userId: string;
  userEmail: string;
  fullName: string;
  role: 'customer' | 'dealer' | 'admin';
}

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

export default function PricePanel({
  config, breakdown, isDealer, discountRate,
  loading, error, userId, userEmail, fullName, role,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Guest contact popup state
  const [showPopup, setShowPopup] = useState(false);
  const [contact, setContact] = useState<ContactInfo>({ name: '', email: '', phone: '' });

  const isGuest = !userId;

  async function submitRequest(contactInfo?: ContactInfo) {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // Save pool config
      await supabase.from('pool_configs').insert({
        user_id: userId || null,
        config: config as unknown as Record<string, unknown>,
        total_price: breakdown.total,
      });

      // If guest, also save contact request
      if (isGuest && contactInfo) {
        await supabase.from('contact_requests').insert({
          name: contactInfo.name,
          email: contactInfo.email,
          phone: contactInfo.phone || null,
          message: `Havuz Teklif Talebi — ${config.length.toFixed(1)}×${config.width.toFixed(1)} m, ${formatTRY(breakdown.total)}`,
        });
      }

      setSaved(true);
      setShowPopup(false);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  }

  function handleTeklifAl() {
    if (isGuest) {
      setShowPopup(true);
    } else {
      submitRequest();
    }
  }

  return (
    <>
      <aside className="card max-h-[80vh] space-y-5 overflow-y-auto p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Özet</h2>
          <p className="text-xs text-slate-500">
            {fullName ? `${fullName} • ` : ''}
            {role === 'dealer' ? 'Bayi fiyatı' : role === 'admin' ? 'Admin görünümü' : 'Müşteri fiyatı'}
          </p>
        </div>

        <ul className="space-y-1.5 text-sm">
          <SummaryItem label="Boyut" value={`${config.length.toFixed(1)} × ${config.width.toFixed(1)} m`} />
          <SummaryItem label="Çerçeve" value={frameLabel(config.frameColor)} />
          <SummaryItem
            label="Panel"
            value={(() => {
              const c = countPanels(config);
              const totalSegs = POOL_SIDES.reduce((sum, s) => sum + segmentsForSide(s, config), 0);
              return `${totalSegs} bölme • ${c.glass} cam, ${c.closed} kapalı`;
            })()}
          />
          <SummaryItem label="Işıklandırma" value={config.lighting.enabled ? `Açık — ${lightLabel(config.lighting.color)}` : 'Kapalı'} />
          <SummaryItem label="Şelale" value={config.waterfall ? 'Var' : 'Yok'} />
          <SummaryItem label="Zemin Altı" value={groundLabel(config.ground)} />
          <SummaryItem label="İç Kaplama" value={claddingLabel(config.cladding)} />
        </ul>

        <div className="border-t border-slate-200 pt-4">
          <PriceLine label="Havuz (taban)" value={breakdown.base} />
          {breakdown.frame > 0 && <PriceLine label="Çerçeve rengi" value={breakdown.frame} />}
          {breakdown.panel > 0 && <PriceLine label="Cam paneller" value={breakdown.panel} />}
          <PriceLine label="Yan platform" value={breakdown.platform} />
          {breakdown.ground > 0 && <PriceLine label="Zemin altı" value={breakdown.ground} />}
          {breakdown.cladding > 0 && <PriceLine label="İç kaplama" value={breakdown.cladding} />}
          {breakdown.lighting > 0 && <PriceLine label="Işıklandırma" value={breakdown.lighting} />}
          {breakdown.waterfall > 0 && <PriceLine label="Şelale" value={breakdown.waterfall} />}
          {breakdown.accessories > 0 && <PriceLine label="Aksesuarlar" value={breakdown.accessories} />}
          {breakdown.poolCover > 0 && <PriceLine label="Üst Kapak" value={breakdown.poolCover} />}
        </div>

        <div className="border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Ara toplam</span>
            <span>{formatTRY(breakdown.subtotal)}</span>
          </div>
          {isDealer && breakdown.discount > 0 && (
            <div className="mt-1 flex justify-between text-emerald-700">
              <span>Bayi indirimi (%{discountRate})</span>
              <span>-{formatTRY(breakdown.discount)}</span>
            </div>
          )}
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-sm text-slate-700">Toplam</span>
            <span className="text-2xl font-bold text-brand-700">
              {loading ? '…' : formatTRY(breakdown.total)}
            </span>
          </div>
          {error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleTeklifAl}
          className="btn-primary w-full"
          disabled={saving || loading}
        >
          {saving ? 'Gönderiliyor…' : 'Teklif Al'}
        </button>
        {saved && (
          <p className="text-center text-sm text-emerald-700">
            Talebiniz alındı. Sizinle en kısa sürede iletişime geçeceğiz.
          </p>
        )}
        {saveError && <p className="text-center text-sm text-red-700">{saveError}</p>}
        {userEmail && <p className="text-center text-xs text-slate-400">{userEmail}</p>}
      </aside>

      {/* Guest contact popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPopup(false)} />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            {/* Close */}
            <button
              type="button"
              onClick={() => setShowPopup(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>

            {/* Header */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900">Teklif Almak İçin</h3>
              <p className="mt-1 text-sm text-slate-500">
                Yapılandırmanız kayıt edilecek, ekibimiz en kısa sürede size ulaşacak.
              </p>
            </div>

            {/* Summary pill */}
            <div className="mb-5 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
              <span className="text-sm text-slate-600">
                {config.length.toFixed(1)} × {config.width.toFixed(1)} m
              </span>
              <span className="text-lg font-bold text-brand-700">{formatTRY(breakdown.total)}</span>
            </div>

            {/* Contact form */}
            <div className="space-y-3">
              <div>
                <label className="label">Adınız Soyadınız *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={contact.name}
                  onChange={e => setContact(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ad Soyad"
                />
              </div>
              <div>
                <label className="label">E-posta *</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={contact.email}
                  onChange={e => setContact(p => ({ ...p, email: e.target.value }))}
                  placeholder="ornek@mail.com"
                />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input
                  type="tel"
                  className="input"
                  value={contact.phone}
                  onChange={e => setContact(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+90 5__ ___ __ __"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!contact.name || !contact.email) return;
                submitRequest(contact);
              }}
              disabled={saving || !contact.name || !contact.email}
              className="btn-primary mt-6 w-full py-3 text-base disabled:opacity-50"
            >
              {saving ? 'Gönderiliyor…' : 'Teklif Gönder'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </li>
  );
}

function PriceLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm text-slate-600">
      <span>{label}</span>
      <span>{formatTRY(value)}</span>
    </div>
  );
}

function frameLabel(c: string) { return { anthracite: 'Antrasit', blue: 'Mavi', white: 'Beyaz' }[c] ?? c; }
function lightLabel(c: string)  {
  return ({
    blue: 'Mavi', white: 'Beyaz', warm_white: 'Sıcak Beyaz',
    green: 'Yeşil', cyan: 'Açık Mavi', turquoise: 'Turkuaz',
    red: 'Kırmızı', orange: 'Turuncu', pink: 'Pembe',
    purple: 'Mor', rgb: 'Gökkuşağı', blue_purple: 'Mavi-Mor',
  } as Record<string, string>)[c] ?? c;
}
function groundLabel(g: string) { return { gravel: 'Çakıl', wood: 'Tahta Deck', grass: 'Çimen', concrete: 'Beton' }[g] ?? g; }
function claddingLabel(c: string) {
  return { white: 'Beyaz', blue_mosaic: 'Mavi Mozaik', gray_stone: 'Gri Taş', turquoise: 'Turkuaz' }[c] ?? (c.startsWith('texture') ? `Özel Desen ${c.slice(-1)}` : c);
}
