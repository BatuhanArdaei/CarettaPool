'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Yetkiniz yok.');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') throw new Error('Yetkiniz yok.');
  return supabase;
}

export async function createProduct(formData: FormData) {
  const supabase = await assertAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const base_price = Number(formData.get('base_price') ?? 0);
  if (!name || !category || !Number.isFinite(base_price)) {
    throw new Error('Geçersiz ürün verisi.');
  }
  const { error } = await supabase.from('products').insert({
    name,
    category,
    base_price,
    is_active: true,
  });
  if (error) throw error;
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function updateProduct(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const base_price = Number(formData.get('base_price') ?? 0);
  const is_active = formData.get('is_active') === 'on';
  if (!id) throw new Error('Eksik ürün id.');
  const { error } = await supabase
    .from('products')
    .update({ name, category, base_price, is_active })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function deleteProduct(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Eksik ürün id.');
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function setDealerPrice(formData: FormData) {
  const supabase = await assertAdmin();
  const dealer_id = String(formData.get('dealer_id') ?? '');
  const product_id = String(formData.get('product_id') ?? '');
  const custom_price = Number(formData.get('custom_price') ?? 0);
  if (!dealer_id || !product_id || !Number.isFinite(custom_price)) {
    throw new Error('Geçersiz fiyat verisi.');
  }
  const { error } = await supabase
    .from('dealer_prices')
    .upsert(
      { dealer_id, product_id, custom_price },
      { onConflict: 'dealer_id,product_id' }
    );
  if (error) throw error;
  revalidatePath('/admin');
}

export async function updateDealerDiscount(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get('id') ?? '');
  const discount_rate = Number(formData.get('discount_rate') ?? 0);
  if (!id) throw new Error('Eksik bayi id.');
  const { error } = await supabase
    .from('dealers')
    .update({ discount_rate })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/admin');
}
