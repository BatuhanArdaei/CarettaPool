'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/supabase/adminGuard';

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

const SECTION_FIELDS = {
  contact: ['email', 'address', 'maps_url'],
  social: ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok'],
} as const;

/** Admin ayarlar sayfası: yalnızca bilinen alanlar, metin olarak kaydedilir. */
export async function saveSiteSection(section: 'contact' | 'social', input: Record<string, unknown>) {
  const supabase = await assertAdmin();
  const fields = SECTION_FIELDS[section];
  if (!fields) throw new Error('Bilinmeyen bölüm');
  const value: Record<string, unknown> = {};
  for (const f of fields) value[f] = String(input?.[f] ?? '').trim().slice(0, 500);
  if (section === 'contact') {
    const phones = Array.isArray(input?.phones) ? input.phones : [];
    value.phones = phones.map((p) => String(p ?? '').trim().slice(0, 40)).slice(0, 4);
  }
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: section, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/ayarlar');
  revalidatePath('/iletisim');
}
