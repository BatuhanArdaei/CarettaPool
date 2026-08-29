# CarettaPool — Sistem Özeti

Bu dosya, projeyi sıfırdan yeniden yaparken kaynak olarak kullanılmak üzere mevcut sistemin
mantık işleyişini, 3D konfigüratör mimarisini ve taşınabilir marka/tasarım öğelerini özetler.

---

## 1. Genel mimari

**Stack:** Next.js 14 App Router + TypeScript + Tailwind, Three.js
(`@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`), Supabase (auth + DB),
framer-motion, driver.js (onboarding turu).

Tek repo, üç alan:

| Alan | Yol | Not |
|---|---|---|
| Tanıtım sitesi | `/[lang]/…` | 15 dil (`lib/i18n/locales/*.json`). `middleware.ts` her isteği `/tr/…` gibi locale'li yola yönlendirir; eski düz yollar (`/urunler` → `/tr/urunler`) redirect edilir |
| 3D konfigüratör | `/[lang]/create` | Giriş şart değil; girişsiz ziyaretçiye `BayiPopup` çıkar |
| Admin | `/admin/*` | Fiyatlar, bayiler, bayi talepleri, galeri, kataloglar, SSS, iletişim talepleri, ayarlar |

**Sayfalar:** ana sayfa (HeroSlider + bölümler), ürünler, galeri, kataloglar, SSS, iletişim, login.
Navbar/Footer server component; footer iletişim ve sosyal linkleri `site_settings`'ten okur.

### Veri modeli (`supabase/schema.sql`)

| Tablo | Amaç |
|---|---|
| `profiles` | `role: customer / dealer / admin` — auth trigger ile otomatik oluşur |
| `dealers` | `discount_rate`, `discount_type: percentage / custom`, `custom_prices` (JSON), `is_active` |
| `pool_configs` | Kaydedilen tasarımlar (config JSON + kullanıcı) |
| `contact_requests` | Konfigüratörden ve iletişim formundan gelen talepler |
| `gallery_items`, `catalogs`, `faqs` | Admin yönetimli içerik, `published` flag'i |
| `site_settings` | key/value JSON: `prices`, `show_prices`, `contact`, `social` |

RLS: herkes yayındaki içeriği okur, kullanıcı kendi kaydını görür, admin her şeyi yönetir.

---

## 2. Konfigüratör akışı

```
RegionSelector → (LoadingScreen 3 sn) → [ConfigPanel 9 adım] + [PoolScene 3D] → Summary → Supabase insert
```

### 2.1 Bölge seçimi — `lib/regions.ts`

Her bölge min/max boyut sınırı tanımlar; slider'lar buna göre kısıtlanır.

| Bölge | Uzunluk | Genişlik |
|---|---|---|
| Türkiye | 4–13 m | 2.30–4.00 m |
| Avrupa | 4–13 m | 2.30–2.90 m |
| Orta Doğu | 4–13 m | 2.30–2.90 m |
| Amerika | 4–11 m | 2.10 m (sabit) |

### 2.2 Tek state: `PoolConfig` — `lib/types.ts`

```ts
interface PoolConfig {
  width: number;            // m
  length: number;           // m
  frameColor: 'anthracite' | 'blue' | 'white';
  panel: 'glass' | 'closed';                    // global varsayılan
  panelOverrides: Record<string, PanelType>;    // "north-2" → tek panel override
  lighting: { enabled: boolean; color: LightColor }; // 12 renk (rgb ve blue_purple animasyonlu)
  ground: 'gravel' | 'wood' | 'grass' | 'concrete';
  cladding: 'white' | 'blue_mosaic' | 'gray_stone' | 'turquoise' | '/textures/…webp';
  platformDirection: 'north' | 'south' | 'east' | 'west';
  platformExtension: boolean;
  railings: boolean;
  innerLadder: boolean;
  waterfall: boolean;
  poolCover: boolean;
  poolCoverType: 'automatic' | 'manual';
  poolCoverClosed: boolean;   // sadece önizleme
  showWater: boolean;
}
```

Varsayılan: 2.30 × 4 m, antrasit, cam panel, çim, beyaz kaplama, platform doğu, merdiven açık.

**Türetilmiş kurallar:**
- Panel genişliği sabit **2.40 m** → `segmentsForSide = max(1, round(kenar / 2.40))`.
- **Doğu kenarı her zaman kapalı** (makine dairesi), override edilemez.
- `countPanels()` cam/kapalı sayısını döner → fiyat hesabına girer.

### 2.3 Sihirbaz adımları — `app/create/components/ConfigPanel.tsx`

`size → frame → panels → waterfall → lighting → ground → finish → preview → summary`

- Üstte tıklanabilir stepper + ilerleme çubuğu, her adımda başlık ve ipucu.
- `panels`: kenar/segment ızgarası, tek tek cam↔kapalı toggle.
- `finish`: 4 standart + 26 seramik texture (thumbnail'ler `/textures/`).
- `preview`: su göster, kapak açık/kapalı, platform yönü/uzatma, korkuluk, merdiven.
- `summary`: seçim özeti + fiyat dökümü + iletişim formu (`CountryPhoneInput`) → `pool_configs` ve `contact_requests` insert.
- `ConfigTour.tsx`: driver.js ile ilk ziyaret turu (`#tour-preview`, `#tour-panel`, `#tour-stepper`, `#tour-reset` hedefleri).

### 2.4 Fiyatlandırma — `lib/pricing.ts` + `app/api/price/route.ts`

- `ConfiguratorClient` config her değişince **300 ms debounce** ile `POST /api/price` çağırır (AbortController ile eski istek iptal).
- Katmanlı override: `DEFAULT_PRICES` (kod) ← `site_settings.prices` (admin) ← bayi `custom_prices` (yalnız `discount_type = custom`). `percentage` modda sonuca yüzde indirim uygulanır.
- `site_settings.show_prices = false` ise fiyat UI'da gizlenir.
- Hesap: `alan(m²) × base_per_sqm` + her seçeneğin sabit ücreti.

```
base_per_sqm 22.000 | frame blue/white 5.000 | panel_glass 4.500/adet
ground wood 22.000 / grass 8.000 / concrete 12.000
cladding blue_mosaic 18.000 / gray_stone 26.000 / turquoise 14.000 / texture 32.000
lighting 9.000 | waterfall 25.000 | platform 35.000
pool_cover manual 38.000 / automatic 55.000
```

Döküm: `base, frame, panel, ground, cladding, platform, lighting, waterfall, accessories, poolCover, subtotal, discount, total`. Format `formatTRY` (tr-TR, ondalıksız).

---

## 3. 3D sahne — `app/create/components/PoolScene.tsx`

Tek dosya, ~4.000 satır. Yeni projede modüllere bölünmeli.

### 3.1 Yaklaşım

Havuz **tamamen prosedürel**: GLB yok, her parça `boxGeometry` / `planeGeometry` / `cylinderGeometry`
primitifleriyle config'ten anlık üretilir. Tek dış model `public/models/villa.glb` (arka plan villası);
`VillaSlot` yüklemeyi dener, hata olursa prosedürel `<Villa>`'ya düşer.

### 3.2 Sabitler (metre)

```
POOL_HEIGHT 1.5    COPING_T 0.10   COPING_W 0.32
PANEL_W 2.40       PANEL_H 1.20    PANEL_T 0.04
FRAME_T 0.10       BASIN_FLOOR 0.06
PLATFORM_DEPTH 2.0
```

Havuz orijinde; **X = genişlik, Z = uzunluk, Y = yükseklik**. Su seviyesi `waterY = POOL_HEIGHT − COPING_T − 0.12`.

### 3.3 Sahne kompozisyonu

```
<Canvas frameloop="demand" shadows>
  Gündüz: <Sky> + HDR Environment + güneş diski + directionalLight(castShadow)
  Gece:   <Stars> + fog + hemisphereLight + ay ışığı + Environment preset="night"
  <Garden>  <Trees>  <VillaSlot>  <Fence>
  <Pool config>
  <OrbitControls>  <CameraRig>  <EnableAllShadows>  <ConfigInvalidator>  <AnimationTicker>
  masaüstü: <EffectComposer> SSAO + Bloom + Vignette + SMAA
```

**`<Pool>` bileşimi (alttan üste):**

| Bileşen | Görev |
|---|---|
| `PoolDeck` | Çim dışı zeminlerde havuz etrafı döşeme (zemin texture'ı) |
| taban plaka | `boxGeometry [w, 0.06, l]`, frame rengi |
| iç kaplama zemin | `planeGeometry` + `CladdingMat` |
| `PoolCaustics` | Zemin kostik shader'ı (sadece su varken) |
| `WaterVolume` | Camdan görünen yarı saydam su kütlesi |
| `InnerRim` | Su üstünde kalan iç kaplama şeridi |
| `SidePanels` | Her kenar × segment ayrı mesh; cam = `transmission` materyal, kapalı = frame rengi |
| `Mullions` | Segmentler arası dikey kayıtlar |
| `CornerPosts`, `FrameBeams` | 4 köşe direği, alt/üst kirişler |
| `Coping` | Ahşap üst bant |
| `CinematicWater` | Su yüzeyi shader'ı |
| `PoolLighting`, `LedStrips` | Üç katmanlı ışık parıltısı + çevre LED şeritleri |
| `Waterfall` | Paslanmaz şelale |
| `PoolCover` | Rulo panjur kapak, animasyonlu açılır/kapanır |
| `PoolLadder` | İç merdiven |
| `Platform` | Yan platform + `Stairs` + `PlatformRailings` + `PlatformFurniture` (şezlong, şemsiye, masa, bardak, kişi figürleri) |

### 3.4 Su shader'ı

- Vertex: 4 büyük + 2 mikro yönlü sinüs dalgası; yükseklik ve türev toplanarak normal üretilir.
- Fragment: fresnel kenar, güneş parıltısı (specular), shimmer, gece havuz ışığı rengi karıştırma.
- `uTime` `useFrame` ile beslenir; ayrı `CAUSTICS_*` shader'ı zemine hareketli kostik çizer.

### 3.5 Gündüz / gece

`isNight = config.lighting.enabled`. Tüm renk haritaları gece varyantlı (`groundColor(g, isNight)`).
Gündüz HDR uzaktan URL: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/outdoor_umbrellas_1k.hdr`
(yeni projede lokal `public/hdr/` altına alınmalı).

### 3.6 Kaplama texture sistemi

- Modül seviyesi `Map` cache + in-flight Promise dedup → aynı URL bir kez iner.
- Sayfa açılınca 2 sn sonra max 3 paralel arka plan preload (27 texture'ı aynı anda göndermek mobili çökertiyor).
- `ConfiguratorClient` HTML `Image` ile tarayıcı HTTP önbelleğini ısıtır.
- `CladdingMat`: texture'ı `clone()` eder (GPU texture paylaşılır), `repeat = round(yüzey / 0.60)` (60 cm karo), `RepeatWrapping`, `SRGBColorSpace`.

### 3.7 Performans kararları

- `frameloop="demand"`; `ConfigInvalidator` config değişince `invalidate()`; `AnimationTicker` su/ışık aktifken ~30 fps.
- Mobil: dpr 1, shadowMap 1024, post-processing kapalı, ağaç sayısı azaltılmış.
- Masaüstü: dpr [1, 1.5], shadowMap 4096, SSAO + Bloom + Vignette + SMAA.
- `antialias: false` (SMAA kullanılıyor), `PCFSoftShadowMap`, `ACESFilmicToneMapping` exposure 1.08.
- `EnableAllShadows`: sahnedeki tüm mesh'lere cast/receive shadow.

### 3.8 Kamera

- `OrbitControls`: minDistance 4, maxDistance 28, `maxPolarAngle = π/2.05` (yer altına inmez), target `[0, 0.75, 0]`.
- 3 preset: `front [0,3,14]`, `top [0,22,2]`, `close [7,5,7]` — `CameraRig` lerp ile geçiş, boşta otomatik orbit.
- "Görünümü sıfırla" butonu `controlsRef.reset()`.

### 3.9 Renk sabitleri

```
Frame:   anthracite #3a3f45 | blue #2da6d2 | white #e5e7eb
Zemin (gündüz): gravel #9e9a8e | wood #b87c3a | grass #4a8c3f | concrete #c8c8c4
Zemin (gece):   gravel #4a4840 | wood #4a2e12 | grass #1a3a18 | concrete #484a4e
Kaplama: white #f1f5f9 | blue_mosaic #2563eb | gray_stone #6b7280 | turquoise #14b8a6
Işık: blue #3b82f6 | white #fff | warm_white #fde68a | green #22c55e | cyan #06b6d4
      turquoise #14b8a6 | red #ef4444 | orange #f97316 | pink #ec4899 | purple #a855f7
      rgb → HSL döngüsü | blue_purple → sinüs salınım (H 0.61–0.78)
Gece gökyüzü #0d1428, sis #162237
```

---

## 4. Marka ve tasarım öğeleri (yeni repoya taşınacaklar)

### Logo
- `public/carettapool.png` — caretta kaplumbağası ikonu (camgöbeği ≈ `#00e5ff`) + beyaz outline "carettapool" yazısı. **Koyu zemin için**.
- `public/carettapool_icon.png` — sadece kaplumbağa, açık gri (`#f2f2f2`). Açık zeminde görünmez; SVG'ye çevirip renklendirilmeli.
- `public/wave_svg.png` — dalga dekoru.

### Renk paleti (`tailwind.config.ts`)
```
brand-50  #ecfeff   brand-100 #cffafe   brand-400 #22d3ee
brand-500 #06b6d4   brand-600 #0891b2   brand-700 #0e7490   brand-900 #164e63
foreground #0f172a  background #f8fafc  footer bg slate-950
tour buton #0ea5c8
```
Nötrler Tailwind `slate`.

### Tipografi ve bileşen dili
- Sistem font stack (`ui-sans-serif, system-ui, Segoe UI, Roboto`).
- Bölüm etiketi: `text-xs font-semibold uppercase tracking-[0.22em] text-slate-500`
- Başlık: `text-3xl md:text-5xl font-bold text-slate-900`
- Buton: `rounded-md bg-brand-500 hover:bg-brand-400 text-white px-7 py-3 text-sm`
- Kart: `rounded-xl bg-white shadow-sm ring-1 ring-slate-200`
- Hazır sınıflar (`globals.css`): `.btn`, `.btn-primary`, `.btn-outline`, `.input`, `.label`, `.card`
- Hero: tam ekran crossfade slider (6.5 sn, rAF ile ilerleme çubuğu), koyu overlay `slate-900/55`.

### Ürün gamı (`lib/products-catalog.ts`)
| Model | Ölçü | Görsel |
|---|---|---|
| ANTALYA | 2.30 × 4 | `havuz_antalya.png` |
| MALTA | 2.30 × 6 | `havuz_malta.png` |
| CRETA | 2.30 × 8 | `havuz_creta.png` |
| BALI | 2.30 × 10 | `havuz_bali.png` |
| CUBA, RIO | — | `havuz_cuba.png`, `havuz_rio.png` |

Her modelde RGB ışık, giriş/temizleyici/vakum nozul ve skimmer sayıları tanımlı.

### Görsel varlıklar (`public/`)
- Havuz fotoğrafları: `havuz-gunduz-*.jpg`, `havuz-gece-*.jpg`, `havuz-gunduz-yakın-cekim-*.jpg`, `havuz-selale-1.jpg`
- Fuar / fabrika: `havuz-fuar-1..14.jpg`, `fabrika-drone-1..3.jpg`
- 26 seramik kaplama texture'ı: `textures/*.webp` (isim eşlemesi `lib/claddingTextures.ts`)
- Zemin texture'ları: `grasstexture.jpg`, `wooddecktexture.jpg`, `graveltexture.jpg`, `concretetexture.jpg`
- Kataloglar: `Caretta-Katalog-ENG/DEU/ESP-WEB.pdf` + kapak görselleri
- Diğer: `neden_biz_main.png`, `simitli_yuzen_kadin.png`

### Diller
tr, en, de, fr, nl, it, pt, es, ro, lt, pl, no, da, el, ar (rtl). Bayraklar `flagcdn.com`.

---

## 5. Yeni projede değiştirilmesi önerilenler

- `PoolScene.tsx`'i modüllere böl (`scene/`, `pool/`, `environment/`, `shaders/`, `materials/`).
- HDR'ı ve bayrakları lokal servis et (dış bağımlılık yok).
- Logo ikonunu SVG olarak yeniden çiz; açık/koyu varyant.
- Fiyat hesabını server'da tut ama breakdown tipini paylaşımlı paket haline getir.
- `panelOverrides` anahtar formatını (`side-index`) koru; region sınırlarını DB'ye taşımayı düşün.
