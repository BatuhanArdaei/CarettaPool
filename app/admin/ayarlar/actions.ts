'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Yetki yok');
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') throw new Error('Yetki yok');
  return createAdminClient();
}

export async function saveSettings(formData: FormData) {
  const supabase = await assertAdmin();
  const section = String(formData.get('section'));

  let value: Record<string, unknown>;

  if (section === 'contact') {
    const phones = [formData.get('phone1'), formData.get('phone2')]
      .map(String)
      .filter((p) => p.trim());
    value = {
      phones,
      email: String(formData.get('email') ?? '').trim(),
      address: String(formData.get('address') ?? '').trim(),
    };
  } else if (section === 'social') {
    value = {
      instagram: String(formData.get('instagram') ?? '').trim(),
      facebook:  String(formData.get('facebook') ?? '').trim(),
      linkedin:  String(formData.get('linkedin') ?? '').trim(),
      youtube:   String(formData.get('youtube') ?? '').trim(),
      tiktok:    String(formData.get('tiktok') ?? '').trim(),
    };
  } else {
    throw new Error('Bilinmeyen bölüm');
  }

  await supabase
    .from('site_settings')
    .upsert({ key: section, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  revalidatePath('/admin/ayarlar');
  revalidatePath('/iletisim');
}
