-- ============================================================================
-- CarettaPool — Güvenlik sıkılaştırması (RLS)
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir; olmayan tabloları atlar.
--
-- 1. Kullanıcı kendi profilindeki "role" alanını değiştiremez (kendini admin yapamaz).
-- 2. Admin kontrolü SECURITY DEFINER fonksiyonla yapılır (profiles üzerinde özyinelemeli
--    politika hatası olmaz).
-- 3. Aşağıdaki tablolardaki TÜM eski politikalar silinir, yalnızca bu dosyadakiler kalır.
-- 4. Teklifler (pool_configs) yalnızca sunucudan (service role) eklenir; tutar dışarıdan
--    değiştirilemez. İletişim formu herkese açık kalır.
-- ============================================================================

-- ─── Admin kontrolü ──────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ─── Rol yükseltme koruması ─────────────────────────────────────────────────
-- Oturum açmış bir kullanıcı (admin değilse) rolünü değiştiremez.
-- Service role ve SQL Editor (auth.uid() boş) etkilenmez.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and new.role is distinct from 'customer' then
      raise exception 'Rol atanamaz';
    end if;
    if tg_op = 'UPDATE' and (new.role is distinct from old.role or new.id is distinct from old.id) then
      raise exception 'Rol değiştirilemez';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- Yeni kayıtta rol her zaman 'customer' (kullanıcı metadata'sındaki rol yok sayılır)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── Eski politikaları temizle, RLS'i aç ─────────────────────────────────────
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'profiles','dealers','site_settings','quotes','pool_configs','contact_requests',
    'gallery_items','catalogs','faqs','products','dealer_prices'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', pol.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

-- ─── Politikalar ─────────────────────────────────────────────────────────────
do $$
begin
  -- profiles: kendi kaydını okur/günceller (rol hariç, tetikleyici korur); admin tümünü yönetir
  if to_regclass('public.profiles') is not null then
    create policy "profiles_select_own" on public.profiles for select using (id = auth.uid() or public.is_admin());
    create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
    create policy "profiles_admin_all"  on public.profiles for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- dealers: bayi kendi kaydını yalnızca okur; değişiklikleri admin yapar
  if to_regclass('public.dealers') is not null then
    create policy "dealers_select_own" on public.dealers for select using (user_id = auth.uid());
    create policy "dealers_admin_all"  on public.dealers for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- site_settings: herkes okur (fiyatlar, iletişim); yalnızca admin yazar
  if to_regclass('public.site_settings') is not null then
    create policy "settings_public_read" on public.site_settings for select using (true);
    create policy "settings_admin_all"   on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- pool_configs: kullanıcı kendi taleplerini okur; ekleme yalnızca sunucudan (/api/quote)
  if to_regclass('public.pool_configs') is not null then
    create policy "pool_configs_select_own" on public.pool_configs for select using (user_id = auth.uid());
    create policy "pool_configs_admin_all"  on public.pool_configs for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- quotes (eski tablo): sahibi okur, admin yönetir
  if to_regclass('public.quotes') is not null then
    create policy "quotes_select_own" on public.quotes for select using (user_id = auth.uid());
    create policy "quotes_admin_all"  on public.quotes for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- contact_requests: iletişim formu herkese açık (yalnızca ekleme); okuma/silme admin
  if to_regclass('public.contact_requests') is not null then
    create policy "contact_public_insert" on public.contact_requests for insert with check (true);
    create policy "contact_admin_all"     on public.contact_requests for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- Yayın içerikleri: yayındakileri herkes okur, admin yönetir
  if to_regclass('public.gallery_items') is not null then
    create policy "gallery_public_read" on public.gallery_items for select using (published = true);
    create policy "gallery_admin_all"   on public.gallery_items for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if to_regclass('public.catalogs') is not null then
    create policy "catalogs_public_read" on public.catalogs for select using (published = true);
    create policy "catalogs_admin_all"   on public.catalogs for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if to_regclass('public.faqs') is not null then
    create policy "faqs_public_read" on public.faqs for select using (published = true);
    create policy "faqs_admin_all"   on public.faqs for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if to_regclass('public.products') is not null then
    create policy "products_public_read" on public.products for select using (is_active = true);
    create policy "products_admin_all"   on public.products for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if to_regclass('public.dealer_prices') is not null then
    create policy "dealer_prices_select_own" on public.dealer_prices for select
      using (exists (select 1 from public.dealers d where d.id = dealer_prices.dealer_id and d.user_id = auth.uid()));
    create policy "dealer_prices_admin_all" on public.dealer_prices for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- ─── Storage (galeri ve katalog dosyaları) ───────────────────────────────────
-- Yüklemeler sunucudan (service role) yapılır; tarayıcıdan yalnızca admin yazabilir.
drop policy if exists "caretta_media_public_read" on storage.objects;
drop policy if exists "caretta_media_admin_write" on storage.objects;
create policy "caretta_media_public_read" on storage.objects for select
  using (bucket_id in ('gallery', 'catalogs'));
create policy "caretta_media_admin_write" on storage.objects for all
  using (bucket_id in ('gallery', 'catalogs') and public.is_admin())
  with check (bucket_id in ('gallery', 'catalogs') and public.is_admin());

-- ─── Kontrol: politikaları listele ───────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname in ('public', 'storage') order by tablename, policyname;
