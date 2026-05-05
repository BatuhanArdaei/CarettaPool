-- ============================================================================
-- Admin panel tables — run this in Supabase SQL Editor
-- ============================================================================

-- Gallery items (uploaded via admin)
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  src_url text not null,
  storage_path text not null,   -- path inside the Supabase storage bucket
  alt text not null default '',
  category text not null check (category in ('havuz','fuar','fabrika')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.gallery_items enable row level security;
create policy "gallery admin all" on public.gallery_items for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "gallery public read" on public.gallery_items for select using (published = true);

-- Catalogs (PDF files uploaded via admin)
create table if not exists public.catalogs (
  id uuid primary key default gen_random_uuid(),
  language text not null,          -- e.g. "English", "Deutsch"
  language_code text not null,     -- e.g. "en", "de", "es"
  flag text not null,              -- flag emoji e.g. "🇬🇧"
  file_url text not null,
  storage_path text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.catalogs enable row level security;
create policy "catalogs admin all" on public.catalogs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "catalogs public read" on public.catalogs for select using (published = true);

-- FAQs
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.faqs enable row level security;
create policy "faqs admin all" on public.faqs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "faqs public read" on public.faqs for select using (published = true);

-- Site settings (key-value store for social links, contact info, etc.)
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy "settings admin all" on public.site_settings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "settings public read" on public.site_settings for select using (true);

-- Seed default site settings
insert into public.site_settings (key, value) values
  ('contact', '{
    "phones": ["+49 211 24700477", "+49 177 6354879"],
    "email": "info@carettapool.de",
    "address": "Fichtenstraße 36, 40233 Düsseldorf, Almanya"
  }'::jsonb),
  ('social', '{
    "instagram": "https://www.instagram.com/carettapool",
    "facebook": "https://www.facebook.com/carettapool/",
    "linkedin": "https://www.linkedin.com/company/carettapool/",
    "youtube": "https://www.youtube.com/@CarettaPool/videos",
    "tiktok": "https://www.tiktok.com/@carettapool"
  }'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- Storage buckets (run these separately if needed or create in Supabase UI)
-- ============================================================================
-- insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true);
-- insert into storage.buckets (id, name, public) values ('catalogs', 'catalogs', true);
