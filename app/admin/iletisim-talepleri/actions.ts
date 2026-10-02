'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/supabase/adminGuard';

export async function markContactRead(id: string) {
  const supabase = await assertAdmin();
  await supabase.from('contact_requests').update({ is_read: true }).eq('id', id);
  revalidatePath('/admin/iletisim-talepleri');
}

export async function deleteContactRequest(id: string) {
  const supabase = await assertAdmin();
  await supabase.from('contact_requests').delete().eq('id', id);
  revalidatePath('/admin/iletisim-talepleri');
}
