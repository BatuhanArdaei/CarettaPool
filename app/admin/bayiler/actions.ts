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

export async function updateDealerDiscount(id: string, discountRate: number) {
  const supabase = await assertAdmin();
  await supabase.from('dealers').update({ discount_rate: discountRate }).eq('id', id);
  revalidatePath('/admin/bayiler');
}
