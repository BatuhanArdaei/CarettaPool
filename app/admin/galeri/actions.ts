'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/supabase/adminGuard';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function uploadGalleryImage(formData: FormData) {
  const supabase = await assertAdmin();
  const file = formData.get('file') as File | null;
  const category = String(formData.get('category') ?? '').trim();
  const alt = String(formData.get('alt') ?? '').trim();

  if (!file || file.size === 0) throw new Error('Dosya seçilmedi');
  if (file.size > MAX_FILE_SIZE) throw new Error('Dosya 10 MB\'dan büyük olamaz');
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    throw new Error('Sadece JPEG, PNG, WebP veya GIF yükleyebilirsiniz');
  if (!['havuz', 'fuar', 'fabrika'].includes(category))
    throw new Error('Geçersiz kategori');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `gallery/${category}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: storageErr } = await supabase.storage
    .from('gallery')
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (storageErr) throw new Error(storageErr.message);

  const { data: { publicUrl } } = supabase.storage.from('gallery').getPublicUrl(path);

  const { error: dbErr } = await supabase
    .from('gallery_items')
    .insert({ src_url: publicUrl, storage_path: path, alt: alt || file.name, category, published: true });
  if (dbErr) throw new Error(dbErr.message);

  revalidatePath('/admin/galeri');
  revalidatePath('/galeri');
}

export async function toggleGalleryPublish(id: string, published: boolean) {
  const supabase = await assertAdmin();
  await supabase.from('gallery_items').update({ published }).eq('id', id);
  revalidatePath('/admin/galeri');
  revalidatePath('/galeri');
}

export async function deleteGalleryItem(id: string) {
  const supabase = await assertAdmin();
  const { data: item } = await supabase.from('gallery_items').select('storage_path').eq('id', id).single();
  if (item?.storage_path) await supabase.storage.from('gallery').remove([item.storage_path]);
  await supabase.from('gallery_items').delete().eq('id', id);
  revalidatePath('/admin/galeri');
  revalidatePath('/galeri');
}
