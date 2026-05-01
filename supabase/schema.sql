-- CarettaPool — Supabase şeması
-- Bu dosyayı Supabase SQL Editor'de çalıştırarak tabloları, RLS politikalarını
-- ve yeni kullanıcılar için profile trigger'ını oluşturabilirsiniz.

-- ============================================================================
-- profiles
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer','dealer','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles self select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles admin all"
  on public.profiles for all
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

-- Trigger: yeni auth.users satırı için profile oluştur
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- dealers
-- ============================================================================
create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  discount_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.dealers enable row level security;

create policy "dealers self select"
  on public.dealers for select
  using (user_id = auth.uid());

create policy "dealers admin all"
  on public.dealers for all
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================================
-- products
-- ============================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  base_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products public read active"
  on public.products for select
  using (is_active = true);

create policy "products admin all"
  on public.products for all
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================================
-- dealer_prices
-- ============================================================================
create table if not exists public.dealer_prices (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  custom_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (dealer_id, product_id)
);

alter table public.dealer_prices enable row level security;

create policy "dealer_prices self select"
  on public.dealer_prices for select
  using (
    exists (select 1 from public.dealers d
            where d.id = dealer_prices.dealer_id and d.user_id = auth.uid())
  );

create policy "dealer_prices admin all"
  on public.dealer_prices for all
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================================
-- pool_configs
-- ============================================================================
create table if not exists public.pool_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null,
  total_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pool_configs enable row level security;

create policy "pool_configs self select"
  on public.pool_configs for select
  using (user_id = auth.uid());

create policy "pool_configs self insert"
  on public.pool_configs for insert
  with check (user_id = auth.uid());

create policy "pool_configs admin select"
  on public.pool_configs for select
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );
