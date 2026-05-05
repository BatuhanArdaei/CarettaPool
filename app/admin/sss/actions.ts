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

export async function createFaq(formData: FormData) {
  const supabase = await assertAdmin();
  const question = String(formData.get('question') ?? '').trim();
  const answer = String(formData.get('answer') ?? '').trim();
  if (!question || !answer) throw new Error('Soru ve cevap zorunlu');
  await supabase.from('faqs').insert({ question, answer, published: false });
  revalidatePath('/admin/sss');
  revalidatePath('/sss');
}

export async function updateFaq(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get('id'));
  const question = String(formData.get('question') ?? '').trim();
  const answer = String(formData.get('answer') ?? '').trim();
  await supabase.from('faqs').update({ question, answer }).eq('id', id);
  revalidatePath('/admin/sss');
  revalidatePath('/sss');
}

export async function toggleFaqPublish(id: string, published: boolean) {
  const supabase = await assertAdmin();
  await supabase.from('faqs').update({ published }).eq('id', id);
  revalidatePath('/admin/sss');
  revalidatePath('/sss');
}

export async function deleteFaq(id: string) {
  const supabase = await assertAdmin();
  await supabase.from('faqs').delete().eq('id', id);
  revalidatePath('/admin/sss');
  revalidatePath('/sss');
}
