import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatTRY } from '@/lib/pricing';
import {
  createProduct,
  deleteProduct,
  setDealerPrice,
  updateDealerDiscount,
  updateProduct,
} from './actions';

export const metadata = { title: 'Admin — CarettaPool' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/');

  const [productsRes, dealersRes, configsRes, dealerPricesRes] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('dealers').select('*').order('company_name', { ascending: true }),
    supabase
      .from('pool_configs')
      .select('id, user_id, total_price, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('dealer_prices').select('*'),
  ]);

  const products = productsRes.data ?? [];
  const dealers = dealersRes.data ?? [];
  const configs = configsRes.data ?? [];
  const dealerPrices = dealerPricesRes.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin Paneli</h1>
        <p className="text-sm text-slate-600">Ürünler, bayiler ve teklif talepleri.</p>
      </div>

      {/* PRODUCTS */}
      <section className="card p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Ürünler</h2>

        <form action={createProduct} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="name" placeholder="Ürün adı" className="input sm:col-span-1" required />
          <input name="category" placeholder="Kategori" className="input" required />
          <input
            name="base_price"
            type="number"
            min="0"
            step="1"
            placeholder="Fiyat (TL)"
            className="input"
            required
          />
          <button className="btn-primary" type="submit">Ekle</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="px-2 py-2">Ad</th>
                <th className="px-2 py-2">Kategori</th>
                <th className="px-2 py-2">Fiyat</th>
                <th className="px-2 py-2">Aktif</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td colSpan={5} className="py-1">
                    <form
                      action={updateProduct}
                      className="grid grid-cols-12 items-center gap-2"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        name="name"
                        defaultValue={p.name}
                        className="input col-span-3"
                      />
                      <input
                        name="category"
                        defaultValue={p.category}
                        className="input col-span-3"
                      />
                      <input
                        name="base_price"
                        type="number"
                        defaultValue={p.base_price}
                        className="input col-span-2"
                      />
                      <label className="col-span-1 flex items-center gap-1 text-xs">
                        <input type="checkbox" name="is_active" defaultChecked={p.is_active} />
                        Aktif
                      </label>
                      <button type="submit" className="btn-outline col-span-2 text-xs">
                        Güncelle
                      </button>
                    </form>
                    <form action={deleteProduct} className="-mt-9 ml-auto flex justify-end">
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Sil
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    Henüz ürün yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DEALERS */}
      <section className="card p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Bayiler</h2>
        {dealers.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıtlı bayi yok.</p>
        ) : (
          <div className="space-y-4">
            {dealers.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{d.company_name}</p>
                    <p className="text-xs text-slate-500">ID: {d.id}</p>
                  </div>
                  <form action={updateDealerDiscount} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <label className="text-sm text-slate-600">Genel indirim %</label>
                    <input
                      name="discount_rate"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      defaultValue={d.discount_rate}
                      className="input w-24"
                    />
                    <button type="submit" className="btn-outline text-xs">
                      Kaydet
                    </button>
                  </form>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Ürün bazında özel fiyat
                  </p>
                  <div className="grid gap-2">
                    {products.map((p) => {
                      const existing = dealerPrices.find(
                        (dp) => dp.dealer_id === d.id && dp.product_id === p.id
                      );
                      return (
                        <form
                          key={p.id}
                          action={setDealerPrice}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input type="hidden" name="dealer_id" value={d.id} />
                          <input type="hidden" name="product_id" value={p.id} />
                          <span className="flex-1 text-slate-700">
                            {p.name}{' '}
                            <span className="text-xs text-slate-400">
                              (taban {formatTRY(p.base_price)})
                            </span>
                          </span>
                          <input
                            name="custom_price"
                            type="number"
                            min="0"
                            defaultValue={existing?.custom_price ?? p.base_price}
                            className="input w-32"
                          />
                          <button type="submit" className="btn-outline text-xs">
                            Kaydet
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* REQUESTS */}
      <section className="card p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Gelen Teklif Talepleri</h2>
        {configs.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz teklif talebi yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="px-2 py-2">Tarih</th>
                  <th className="px-2 py-2">Kullanıcı</th>
                  <th className="px-2 py-2 text-right">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configs.map((c) => (
                  <tr key={c.id}>
                    <td className="px-2 py-2">
                      {new Date(c.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{c.user_id}</td>
                    <td className="px-2 py-2 text-right font-semibold">
                      {formatTRY(c.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
