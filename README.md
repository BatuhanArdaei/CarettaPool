# CarettaPool

Lüks havuz tasarımı ve satış sitesi. Tek repo:

- `carettapool.com` — tanıtım sitesi (ana sayfa, ürünler, hakkımızda, iletişim)
- `carettapool.com/create` — 3D havuz konfigüratörü (korumalı)
- `carettapool.com/admin` — admin paneli (sadece admin)

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Three.js + `@react-three/fiber` + `@react-three/drei`
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — auth + DB

## Kurulum

```bash
npm install
cp .env.local.example .env.local
# .env.local içine Supabase anahtarlarınızı ekleyin
npm run dev
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

## Supabase

1. Supabase projesi oluşturun.
2. `supabase/schema.sql` dosyasını SQL Editor'de çalıştırın.
   - `profiles`, `dealers`, `products`, `dealer_prices`, `pool_configs` tablolarını,
   - RLS politikalarını,
   - Yeni kullanıcılar için otomatik `profiles` kaydı oluşturan trigger'ı kurar.
3. Authentication → Providers → **Email** etkin olmalı.
4. İlk admin kullanıcıyı oluşturmak için sitede `/login` üzerinden bir hesap açın,
   sonra Supabase'de SQL Editor'den:
   ```sql
   update public.profiles set role = 'admin' where id = '<USER_UUID>';
   ```

## Sayfa Yapısı

```
app/
├── page.tsx                  Ana sayfa (hero, ürünler, hakkımızda, iletişim)
├── login/
│   ├── page.tsx              Giriş sayfası
│   └── LoginForm.tsx
├── create/
│   ├── page.tsx              3D konfigüratör (auth gerektirir)
│   └── components/
│       ├── ConfiguratorClient.tsx   State + layout
│       ├── ConfigPanel.tsx          Sol panel — seçenekler
│       ├── PoolScene.tsx            Three.js sahne
│       └── PricePanel.tsx           Sağ panel — özet & fiyat
├── admin/
│   ├── page.tsx              Admin (sadece role='admin')
│   └── actions.ts            Server actions (CRUD)
├── api/
│   └── price/route.ts        Fiyat hesaplama API'si
├── auth/
│   ├── callback/route.ts     OAuth/magic-link callback
│   └── signout/route.ts      POST → sign out
├── layout.tsx
└── globals.css

components/   Navbar, Footer
lib/
├── pricing.ts                Fiyat hesaplama + TRY format
├── types.ts                  PoolConfig, Profile, Dealer, Product
└── supabase/
    ├── client.ts             Browser client
    ├── server.ts             Server + admin client
    └── middleware.ts         Session refresh + route koruması

middleware.ts                 /create, /admin için auth check
```

## Fiyatlandırma

`lib/pricing.ts` içindeki sabitler tüm konfigürasyon seçeneklerini fiyatlandırır.
İstemci her değişiklikte `/api/price` endpoint'ine POST atar; sunucu kullanıcının
bayi olup olmadığını kontrol edip varsa indirim oranını uygular.

## 3D Sahne Notları

- Pool, `width × length` (2-10 m arası slider) gerçek zamanlı güncellenir.
- Duvar tipi: kapalı = beton, açık = transparan cam (mesh opacity).
- Işıklandırma açıksa havuz altına `pointLight` eklenir, renk değiştirilebilir.
- Şelale yönü kuzey/güney/doğu/batı kutu konumunu belirler.
- Kamera `OrbitControls` ile döndürülebilir.

## Geliştirme

```bash
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit
npm run build
```
