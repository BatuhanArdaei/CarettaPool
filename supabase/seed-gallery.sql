-- RLS'yi geçici devre dışı bırakarak ekle (SQL Editor service role olarak çalışır)
alter table public.gallery_items disable row level security;

insert into public.gallery_items (src_url, storage_path, alt, category, published)
select src_url, storage_path, alt, category::text, published
from (values
  ('/havuz-gunduz-1.jpg',            'havuz-gunduz-1.jpg',             'Havuz gündüz 1',   'havuz', true),
  ('/havuz-gunduz-2.jpg',            'havuz-gunduz-2.jpg',             'Havuz gündüz 2',   'havuz', true),
  ('/havuz-gunduz-3.jpg',            'havuz-gunduz-3.jpg',             'Havuz gündüz 3',   'havuz', true),
  ('/havuz-gece-1.jpg',              'havuz-gece-1.jpg',               'Havuz gece 1',     'havuz', true),
  ('/havuz-gece-2.jpg',              'havuz-gece-2.jpg',               'Havuz gece 2',     'havuz', true),
  ('/havuz-gece-3.jpg',              'havuz-gece-3.jpg',               'Havuz gece 3',     'havuz', true),
  ('/havuz-gunduz-yakın-cekim-1.jpg','havuz-gunduz-yakin-1.jpg',       'Yakın çekim 1',    'havuz', true),
  ('/havuz-gunduz-yakın-cekim-2.jpg','havuz-gunduz-yakin-2.jpg',       'Yakın çekim 2',    'havuz', true),
  ('/havuz-gunduz-yakın-cekim-3.jpg','havuz-gunduz-yakin-3.jpg',       'Yakın çekim 3',    'havuz', true),
  ('/havuz-selale-1.jpg',            'havuz-selale-1.jpg',             'Şelale detayı',    'havuz', true),
  ('/havuz-fuar-1.jpg',              'havuz-fuar-1.jpg',               'Fuar 1',           'fuar',  true),
  ('/havuz-fuar-2.jpg',              'havuz-fuar-2.jpg',               'Fuar 2',           'fuar',  true),
  ('/havuz-fuar-3.jpg',              'havuz-fuar-3.jpg',               'Fuar 3',           'fuar',  true),
  ('/havuz-fuar-4.jpg',              'havuz-fuar-4.jpg',               'Fuar 4',           'fuar',  true),
  ('/havuz-fuar-5.jpg',              'havuz-fuar-5.jpg',               'Fuar 5',           'fuar',  true),
  ('/havuz-fuar-6.jpg',              'havuz-fuar-6.jpg',               'Fuar 6',           'fuar',  true),
  ('/havuz-fuar-7.jpg',              'havuz-fuar-7.jpg',               'Fuar 7',           'fuar',  true),
  ('/havuz-fuar-8.jpg',              'havuz-fuar-8.jpg',               'Fuar 8',           'fuar',  true),
  ('/havuz-fuar-9.jpg',              'havuz-fuar-9.jpg',               'Fuar 9',           'fuar',  true),
  ('/havuz-fuar-10.jpg',             'havuz-fuar-10.jpg',              'Fuar 10',          'fuar',  true),
  ('/havuz-fuar-11.jpg',             'havuz-fuar-11.jpg',              'Fuar 11',          'fuar',  true),
  ('/havuz-fuar-12.jpg',             'havuz-fuar-12.jpg',              'Fuar 12',          'fuar',  true),
  ('/havuz-fuar-13.jpg',             'havuz-fuar-13.jpg',              'Fuar 13',          'fuar',  true),
  ('/havuz-fuar-14.jpg',             'havuz-fuar-14.jpg',              'Fuar 14',          'fuar',  true),
  ('/havuz-fuar-motor.jpg',          'havuz-fuar-motor.jpg',           'Motor odası',      'fuar',  true),
  ('/fabrika-drone-1.jpg',           'fabrika-drone-1.jpg',            'Fabrika drone 1',  'fabrika',true),
  ('/fabrika-drone-2.jpg',           'fabrika-drone-2.jpg',            'Fabrika drone 2',  'fabrika',true),
  ('/fabrika-drone-3.jpg',           'fabrika-drone-3.jpg',            'Fabrika drone 3',  'fabrika',true)
) as t(src_url, storage_path, alt, category, published)
where not exists (
  select 1 from public.gallery_items g where g.src_url = t.src_url
);

-- RLS'yi tekrar aç
alter table public.gallery_items enable row level security;

-- Kontrol
select category, count(*) from public.gallery_items group by category;
