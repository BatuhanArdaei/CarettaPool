-- Bayi bölgesi: bayi konfigüratörde bölge seçmez, kayıtlı olduğu bölgenin sınırlarıyla başlar.
-- Supabase → SQL Editor'de bir kez çalıştırın. Mevcut bayiler 'turkey' olarak atanır;
-- doğru bölgeyi Admin → Bayiler sayfasından seçin.

alter table public.dealers
  add column if not exists region text not null default 'turkey';

alter table public.dealers
  drop constraint if exists dealers_region_check;

alter table public.dealers
  add constraint dealers_region_check
  check (region in ('turkey', 'europe', 'usa', 'middle_east'));
