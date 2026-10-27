-- Teklif formu: ad/soyad ayrı, adres, posta kodu ve e-posta doğrulama kodu.
-- Supabase SQL Editor'da bir kez çalıştırın (tekrar çalıştırılabilir).

-- ─── İletişim talepleri: yeni alanlar ────────────────────────────────────────
alter table public.contact_requests add column if not exists first_name  text;
alter table public.contact_requests add column if not exists last_name   text;
alter table public.contact_requests add column if not exists address     text;
alter table public.contact_requests add column if not exists postal_code text;

-- ─── E-posta doğrulama kodları ──────────────────────────────────────────────
-- Kodun kendisi saklanmaz, yalnızca HMAC özeti. Tabloya yalnızca sunucu (service role)
-- erişir: RLS açık ve hiç politika yok, yani tarayıcıdan okunamaz/yazılamaz.
create table if not exists public.email_verifications (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  attempts    int  not null default 0,
  expires_at  timestamptz not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists email_verifications_email_created_idx
  on public.email_verifications (email, created_at desc);

alter table public.email_verifications enable row level security;
