import { createAdminClient, createClient } from './server';

/**
 * Sunucu tarafı admin kontrolü (server action / route handler içinde çağrılır).
 * Oturumdaki kullanıcı admin değilse hata fırlatır; adminse service-role istemcisini döner.
 * Tarayıcıdan veritabanına doğrudan yazılmaz: tüm admin yazmaları bu kontrolden geçer.
 */
export async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Yetki yok');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Yetki yok');
  return createAdminClient();
}
