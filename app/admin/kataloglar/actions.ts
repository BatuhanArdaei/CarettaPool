'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Yetki yok');
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Yetki yok');
  return createAdminClient();
}

/** Triple-layered PDF validation:
 *  1. Extension must be .pdf
 *  2. MIME type must be application/pdf
 *  3. File magic bytes must start with %PDF  */
async function validatePdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('Sadece .pdf uzantılı dosyalar kabul edilir');
  if (file.type !== 'application/pdf')
    throw new Error('Dosya tipi application/pdf olmalıdır');
  if (file.size > MAX_PDF_SIZE)
    throw new Error('PDF 50 MB\'dan büyük olamaz');
  if (file.size === 0)
    throw new Error('Boş dosya yüklenemez');

  // Check PDF magic bytes: first 4 bytes = 0x25 0x50 0x44 0x46 ("%PDF")
  const slice = await file.slice(0, 4).arrayBuffer();
  const magic = new Uint8Array(slice);
  if (magic[0] !== 0x25 || magic[1] !== 0x50 || magic[2] !== 0x44 || magic[3] !== 0x46)
    throw new Error('Geçersiz PDF dosyası (imza uyuşmuyor). Farklı dosya türleri kabul edilmez.');
}

export async function uploadCatalog(formData: FormData) {
  const supabase = await assertAdmin();
  const file = formData.get('file') as File | null;
  const language = String(formData.get('language') ?? '').trim();
  const languageCode = String(formData.get('languageCode') ?? '').trim();
  const flag = String(formData.get('flag') ?? '').trim();

  if (!file || file.size === 0) throw new Error('PDF dosyası seçilmedi');
  await validatePdf(file);
  if (!language || !languageCode || !flag) throw new Error('Dil bilgisi eksik');

  const path = `catalogs/${languageCode}-${Date.now()}.pdf`;
  const buffer = await file.arrayBuffer();

  const { error: storageErr } = await supabase.storage
    .from('catalogs')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false });
  if (storageErr) throw new Error(storageErr.message);

  const { data: { publicUrl } } = supabase.storage.from('catalogs').getPublicUrl(path);

  const { error: dbErr } = await supabase
    .from('catalogs')
    .insert({ language, language_code: languageCode, flag, file_url: publicUrl, storage_path: path, published: true });
  if (dbErr) throw new Error(dbErr.message);

  revalidatePath('/admin/kataloglar');
  revalidatePath('/kataloglar');
}

export async function toggleCatalogPublish(id: string, published: boolean) {
  const supabase = await assertAdmin();
  await supabase.from('catalogs').update({ published }).eq('id', id);
  revalidatePath('/admin/kataloglar');
  revalidatePath('/kataloglar');
}

export async function deleteCatalog(id: string, storagePath: string) {
  const supabase = await assertAdmin();
  await supabase.storage.from('catalogs').remove([storagePath]);
  await supabase.from('catalogs').delete().eq('id', id);
  revalidatePath('/admin/kataloglar');
  revalidatePath('/kataloglar');
}
