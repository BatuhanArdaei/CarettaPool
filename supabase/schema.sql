-- ============================================================================
-- CarettaPool — Tam Veritabanı Şeması
-- Supabase SQL Editor'de çalıştırın (önce varsa tabloları drop edin)
-- ============================================================================

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'customer'
             check (role in ('customer','dealer','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: kendi kaydını oku"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles: kendi kaydını güncelle"
  on public.profiles for update using (auth.uid() = id);

create policy "profiles: admin tümünü yönetir"
  on public.profiles for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Trigger: yeni auth.users satırında otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── DEALERS ─────────────────────────────────────────────────────────────────
create table if not exists public.dealers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_name  text not null,
  discount_rate numeric(5,2) not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id)
);

alter table public.dealers enable row level security;

create policy "dealers: kendi kaydını oku"
  on public.dealers for select using (user_id = auth.uid());

create policy "dealers: admin tümünü yönetir"
  on public.dealers for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,
  base_price  numeric(12,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products: aktif olanları herkes okur"
  on public.products for select using (is_active = true);

create policy "products: admin tümünü yönetir"
  on public.products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── DEALER_PRICES ───────────────────────────────────────────────────────────
create table if not exists public.dealer_prices (
  id           uuid primary key default gen_random_uuid(),
  dealer_id    uuid not null references public.dealers(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  custom_price numeric(12,2) not null default 0,
  created_at   timestamptz not null default now(),
  unique (dealer_id, product_id)
);

alter table public.dealer_prices enable row level security;

create policy "dealer_prices: kendi fiyatlarını oku"
  on public.dealer_prices for select
  using (exists (select 1 from public.dealers d where d.id = dealer_prices.dealer_id and d.user_id = auth.uid()));

create policy "dealer_prices: admin tümünü yönetir"
  on public.dealer_prices for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── POOL_CONFIGS ────────────────────────────────────────────────────────────
create table if not exists public.pool_configs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  config      jsonb not null,
  total_price numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.pool_configs enable row level security;

create policy "pool_configs: kendi taleplerim"
  on public.pool_configs for select using (user_id = auth.uid());

create policy "pool_configs: kaydet"
  on public.pool_configs for insert with check (true); -- misafir de kaydedebilir

create policy "pool_configs: admin tümünü görür"
  on public.pool_configs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── GALLERY_ITEMS ───────────────────────────────────────────────────────────
create table if not exists public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  src_url      text not null,
  storage_path text not null,
  alt          text not null default '',
  category     text not null check (category in ('havuz','fuar','fabrika')),
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.gallery_items enable row level security;

create policy "gallery: yayındakiler herkese açık"
  on public.gallery_items for select using (published = true);

create policy "gallery: admin tümünü yönetir"
  on public.gallery_items for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── CATALOGS ────────────────────────────────────────────────────────────────
create table if not exists public.catalogs (
  id            uuid primary key default gen_random_uuid(),
  language      text not null,
  language_code text not null,
  flag          text not null,
  file_url      text not null,
  storage_path  text not null,
  published     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.catalogs enable row level security;

create policy "catalogs: yayındakiler herkese açık"
  on public.catalogs for select using (published = true);

create policy "catalogs: admin tümünü yönetir"
  on public.catalogs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── FAQS ────────────────────────────────────────────────────────────────────
create table if not exists public.faqs (
  id            uuid primary key default gen_random_uuid(),
  question      text not null,
  answer        text not null,
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.faqs enable row level security;

create policy "faqs: yayındakiler herkese açık"
  on public.faqs for select using (published = true);

create policy "faqs: admin tümünü yönetir"
  on public.faqs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── SITE_SETTINGS ───────────────────────────────────────────────────────────
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "settings: herkes okuyabilir"
  on public.site_settings for select using (true);

create policy "settings: admin yönetir"
  on public.site_settings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── VARSAYILAN AYARLAR ───────────────────────────────────────────────────────
insert into public.site_settings (key, value) values
  ('contact', '{"phones":["+49 211 24700477","+49 177 6354879"],"email":"info@carettapool.de","address":"Fichtenstraße 36, 40233 Düsseldorf, Almanya"}'::jsonb),
  ('social',  '{"instagram":"https://www.instagram.com/carettapool","facebook":"https://www.facebook.com/carettapool/","linkedin":"https://www.linkedin.com/company/carettapool/","youtube":"https://www.youtube.com/@CarettaPool/videos","tiktok":"https://www.tiktok.com/@carettapool"}'::jsonb)
on conflict (key) do nothing;

-- ─── ADMİN KULLANICISI ────────────────────────────────────────────────────────
-- admin@gmail.com hesabını oluşturduktan sonra aşağıdaki satırı çalıştırın:
--
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@gmail.com');
--
-- Yoksa direkt insert ile de oluşturabilirsiniz:
insert into public.profiles (id, full_name, role)
select id, 'Admin', 'admin'
from auth.users
where email = 'admin@gmail.com'
on conflict (id) do update set role = 'admin';
