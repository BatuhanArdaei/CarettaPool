# CarettaPool — Arıza / Revizyon Özeti

Yeni repoya başlarken "ilk günden çöz" listesi. Sayılar git geçmişinden çıkarıldı
(30 Nisan – 24 Haziran 2026, 36 commit). Önceki oturumların konuşma kayıtları yok;
"kaç kez" = kaç kez yeniden yazıldı/geri alındı.

---

## 1. Büyük resim: konfigüratör 4 kez yazıldı

| # | Tarih | Yer | Ne oldu |
|---|---|---|---|
| 1 | Mart 2026 | `3DHavuzSite/app/olustur` | 8 adımlı akış (şekil / fayans / jakuzi) |
| 2 | Nisan başı | aynı repo | "sıfırdan başla" → create.carettapool.com benzeri 6 adım |
| 3 | 24 Nisan | `3DHavuz-Olustur-Site` (ayrı repo, subdomain) | Sidebar + özet kartı + Supabase |
| 4 | 30 Nisan | `CarettaPool` (tek repo) | Bugünkü sistem — 24 Haziran'da durdu |

Sıradaki 5. deneme. Ortak sebep: kapsam her seferinde baştan büyüdü, 3D sahne tek dosyada şişti,
mobil/performans en sona kaldı.

---

## 2. Tekrar tekrar revize edilenler (çoktan aza)

| Konu | Kez | Geçmiş |
|---|---|---|
| **Kaplama texture'ları** | **7** | 100 MB JPG → WebP (11 Haz "TextureDüzeltmeDenemeleri1") → Türkçe karakterli dosya adları rename (12 Haz) → Mac `._` artıkları + render kopyaları silindi (20 Haz) → legacy `texture1..5` kaldırıldı (22 Haz) → cache + dedup + "3 paralel / 0.8 s" preloader (23 Haz) → aynı gün "hepsi hemen paralel" → ertesi gün mobil çöktü: "max 3 / 2 s gecikme" + state race bugfix + mobilde 6 texture + lazy grid (24 Haz). `çöp/` klasörü hâlâ repoda |
| **Mobil 3D önizleme** | **5** | 35vh sticky → 38/48vh → sticky kaldırıldı 45vh → 35vh; mobil dpr / gölge / post-processing ayrımı; son commit "güncelleme mobil" |
| **Bölge seçici** | **4** | 5 bölge, 2–14 m × 5 m (9 May) → tamamen silindi (13 May) → sıfırdan yazıldı, 4 bölge, gerçek sınırlar (23 May) → Avrupa 14→13 m (18 Haz) |
| **Zemin (çim / ahşap / …)** | **4** | Düz renk → canvas prosedürel (13 May) → görsel dosyalar, yeniden yazıldı (23 May) → normal map + çim "zengin"→"tek ton", çimde deck gizlendi (22 Haz) |
| **Su** | **4** | Basit yüzey → GLSL dalga + kostik (5 May) → `showWater` toggle, varsayılan açık (18 Haz) → gökyüzü yansıması (20 Haz) → varsayılan kapalı (22 Haz) |
| **Adım akışı** | **4** | Tek sayfa → 6 adım (aynı gün) → zemin ayrı adım (7) → i18n + özet (8) → önizleme adımı (9) |
| **Fiyat anahtarları** | **4** | Düz → `frame_blue` tarzı + admin override (13 Haz) → `pool_cover` tek → manuel/otomatik ikiye bölündü; `lighting_dual` eklendi (21 Haz) ve silindi (22 Haz) |
| **Platform / merdiven / korkuluk** | **3** | `platformExtension` + `stairs` eklendi, varsayılan açık (13 May) → aynı gün kapalı → `stairs` kaldırıldı, `railings` + `innerLadder` eklendi (23 May) |
| **Villa / arka plan** | **3** | Prosedürel villa → aynı gün GLB fallback slot → `ModernVilla` yazıldı ama hiç bağlanmadı, `villa.glb` eklendi (22 Haz) |
| **Aydınlatma** | **3** | 5 renk → dual mod (`color2`) + 12 renk (18 Haz) → dual 4 gün sonra silindi, `blue_purple` preset (22 Haz) |
| **Dış kaplama** | **3** | Panel dışına kaplama (12 Haz) → kaldırıldı "sadece iç zemin" (18 Haz) → kapalı panellerin iç yüzüne geri geldi (22 Haz) |
| **Post-processing** | **3** | Bloom + Vignette → SSAO + SMAA eklendi → mobilde tamamen kapatıldı |
| **Özet / fiyat paneli** | **2** | 3 sütun (panel / 3D / PricePanel) → PricePanel kaldırıldı, özet 9. adım oldu (5 May); dosya silinmedi, 8 commit boyunca ölü dosya güncellendi |
| **Admin paneli** | **2** | `admin-panel/` ve `admin/` paralel yazıldı → 795 satırlık `admin-panel` silindi (21 Haz) |
| **Varsayılan havuz** | **2** | 4×6 m + manuel `panelSegments` → 2.30×4 m + 2.40 m sabit panelden otomatik |
| **Kişi figürleri** | **1 (yarım)** | PNG sprite planı yazıldı (prompt bile kodda), PNG hiç eklenmedi, bileşen artık çağrılmıyor |

`PoolScene.tsx`: 20 commit, ~5.000 satır ekle/sil. En yoğun hafta 18–24 Haziran (7 commit, 1.500+ satır), sonra bırakıldı.

---

## 3. Hâlâ oturmayan / uyumsuz olanlar (24 Haziran itibarıyla)

### Kırık / riskli
- `npm run typecheck` geçmiyor — **13 hata**: Supabase cookie tipleri (`lib/supabase/middleware.ts` ×6, `server.ts` ×4), `animejs` tip dosyası yok (×2), `components/PhoneInput.tsx:65` (×1).
- `app/api/seed-admin/route.ts`: `admin@carettapool.test / 123456` hardcoded, GET ile herkese açık.
- `app/api/debug-auth/route.ts` prod'da duruyor.
- Gündüz HDR `dl.polyhaven.org`, bayraklar `flagcdn.com` — dış servis düşerse sahne / nav bozulur.

### Çift / ölü kod
- Düz sayfalar `app/urunler, galeri, iletisim, sss, kataloglar, login, create` middleware yüzünden erişilemez; `[lang]/[slug]` ile birebir kopya. Sadece `GaleriGrid` ve `ContactForm` oradan import ediliyor.
- `app/login` → `/create`, `[lang]/login` → `/admin` yönlendiriyor. Tutarsız.
- `PricePanel.tsx` (281 satır) ve `PhoneInput.tsx` hiçbir yerden import edilmiyor.
- `PoolScene` içinde kullanılmayan: `ModernVilla`, `Loungers`, `FlowerPots`, `PersonOnChair` (+ `useSafeTexture`).
- `@21st-dev/magic` bağımlılığı hiç kullanılmıyor.
- `public/textures/çöp/` (3 dosya, ~4 MB) repoda.
- 15 dilde 59 tanımlı-ama-kullanılmayan çeviri anahtarı.
- `README.md` eski yapıyı (düz route'lar, `PricePanel`) anlatıyor.

### Mantık uyumsuzlukları
- `isNight === lighting.enabled`: gündüz ışık gösterilemiyor, ışıksız gece yok. İki kavram tek toggle'da.
- Platform her zaman 35.000 ₺ ekleniyor ama kapatılamıyor; `platform_extension`, `railings`, `ladder` anahtarları var ama hepsi 0.
- Doğu kenarı "makine dairesi, hep kapalı" ama varsayılan platform yönü de doğu.
- `PoolScene.tsx` 4.032 satır tek dosya — sahne, shader, materyal, mobilya, çevre bir arada.
- Texture dosya adlarında boşluk / büyük-küçük harf / çift boşluk (`OXSiDE TURKUAZ  60x120.webp`) — iki kez rename'e sebep oldu, hâlâ risk.
- Eski `pool_configs` kayıtlarında silinmiş alanlar (`stairs`, `panelSegments`, `lighting.mode/color2`) ve `site_settings.prices` içinde `lighting_dual` kalmış olabilir.
- `poolCoverClosed` sadece önizleme; config'e kaydediliyor ama anlamı yok.

### Tasarım borcu
- Logo ikonu PNG, açık gri — açık zeminde görünmüyor; SVG yok.
- Marka rengi kodda Tailwind cyan (`#06b6d4`), logoda `#00e5ff` civarı — birebir değil.

---

## 4. Yeni repoda ilk günden karar verilecekler

1. Texture pipeline: dosya adı kuralı (küçük harf, tire, ASCII), boyut limiti, WebP, preload stratejisi — **kod yazmadan önce**.
2. Mobil önce: 3D önizleme yüksekliği, dpr, gölge, post-processing sınırları baştan sabitlensin.
3. Gece/gündüz ile aydınlatma ayrı state.
4. Bölge sınırları ve fiyat anahtarları tek kaynaktan (DB veya tek config), kod içinde kopya yok.
5. `PoolScene` baştan modüler: `scene/ pool/ environment/ shaders/ materials/`.
6. Tek routing yapısı (`[lang]` ya da düz), ikisi birden değil.
7. Debug/seed endpoint'leri repoya girmesin.
