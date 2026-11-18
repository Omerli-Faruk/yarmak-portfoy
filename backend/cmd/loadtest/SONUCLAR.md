# Yük testi sonuçları

**Tarih:** 6 Kasım 2026

**Ortam:** Tek Windows 10 makinesi. Postgres 16 Docker'da, API worktree'den derlendi. Sahte Yahoo 200 ms gecikmeyle çalıştı.

**Senaryo:** 300 eşzamanlı sanal kullanıcı, 60 sn, 5 sn'de kademeli başlangıç. Her kullanıcı her istekten sonra 0,5–2 sn bekler.

**İstek karışımı:**
- %60 hisse grafiği: popüler hisselere ağırlıklı 60 hisse, 8 aralık
- %20 portföy grafiği: 4 aralık
- %20 fon grafiği: geçmişi olan 21 fon

Gerçek Yahoo'ya hiç istek gitmedi; API `YAHOO_BASE_URL` ile programın açtığı sahte sunucuya yönlendirildi.

## 1. Normal durum

| | Değer |
|---|---|
| Kullanıcı isteği | 13.280 (saniyede 221) |
| Başarılı (HTTP 200) | **13.280 / 13.280** |
| Hisse grafiği p50 / p95 / p99 | 1 ms / 6 ms / 3,2 sn |
| Portföy grafiği p50 / p95 / p99 | 3 ms / 4 ms / 5 ms |
| Fon grafiği p50 / p95 / p99 | 4 ms / 6 ms / 8 ms |
| **Yahoo'ya giden istek** | **149** (kullanıcı isteği başına 0,011) |
| Yahoo'ya saniyede ortalama | 2,5 (sınır 2/sn, açılışta 20'lik biriktirme hakkı) |

Hisse grafiğinde p99'un 3,2 sn olmasının sebebi şu: soğuk bir grafik için Yahoo sırası 3 sn'yi geçerse istek beklemeyi bırakıp veritabanındaki veriyle cevap veriyor. Yahoo'ya giden hız bu yüzden kullanıcı sayısından bağımsız kalıyor.

Gram altın gibi türetilmiş semboller kapıdan bir kez geçip Yahoo'ya iki istek atıyor (ons ve dolar). Ortalamanın 2'yi biraz aşmasının sebebi bu.

## 2. Yahoo engellediğinde (429)

Sahte Yahoo 50. istekten sonra her isteğe 429 döndü.

| | Değer |
|---|---|
| Kullanıcı isteği | 13.826 |
| Başarılı (HTTP 200) | **13.826 / 13.826** |
| Engel sırasında Yahoo'ya giden istek | **6** (hepsi engel anında zaten yolda olanlar), sonraki ~50 sn boyunca **0** |
| Sunucu logunda panic/ERROR | 0 |

Devre kesici ilk 429'da Yahoo'ya istek atmayı 5 dk durdurdu. Kullanıcılar bu sürede önbellekteki ya da veritabanındaki veriyi gördü.

## 3. Farklı portföylü kullanıcılar (18 Kasım 2026)

İlk iki testte bütün sanal kullanıcılar aynı demo hesabını kullandı; portföy grafiğinin kullanıcıya özel önbelleği hep doluydu. Bu testte her sanal kullanıcı kendi hesabıyla girdi. Veritabanının bir kopyasına 999 test hesabı eklendi; her hesapta rastgele 3–8 hisse/fon (toplam 1.202 farklı varlık, 5.496 alım işlemi). Varlıklar bilerek dağınık seçildi: gerçek kullanıcılar popüler hisselerde toplanır, burada ortak fiyat önbelleği en az işe yarıyor (kötü senaryo). İsteklerin tamamı portföy grafiği (`/portfolio/value-history`, 4 aralık). Test BIST seans saatinde yapıldı, fiyat işçisi de aynı anda çalışıyordu.

| | 300 kullanıcı / 300 hesap | 1.000 kullanıcı / 999 hesap |
|---|---|---|
| Kullanıcı isteği (60 sn) | 13.793 (saniyede 230) | 44.217 (saniyede 737) |
| Başarılı (HTTP 200) | **13.793 / 13.793** | **44.217 / 44.217** |
| p50 / p95 / p99 | 3 ms / 12 ms / 17 ms | 3 ms / 14 ms / 23 ms |
| En uzun | 6,1 sn | 5,7 sn |
| Yahoo'ya giden (fiyat işçisi hariç) | ~85 (saniyede ~1,4) | ~80 (saniyede ~1,3) |
| API bellek (test sonu) | – | 76 MB |

Yahoo sayısı: sahte Yahoo'ya toplam 335 / 393 istek geldi; bunların ~250 / ~313'ü aynı anda çalışan BIST fiyat işçisinin (log'daki "BIST fiyat başarıyla güncellendi" satırları), kapıdan geçmiyor. En uzun süreler soğuk grafiğin kapı sırasında 3 sn beklemesi; sonra veritabanı verisiyle cevap veriliyor.

Sonuç: istek anında hesaplanan portföy grafiği, 1.000 farklı portföyde de sorunsuz. Fiyat geçmişleri kullanıcılar arasında paylaşılıyor (kapı), kullanıcıya özel birleştirme veritabanından ve 5 dk önbellekten geliyor. Bu ölçümle günlük portföy fotoğrafı tablosu (`portfolio_snapshots`, ön yüz okumuyordu) kaldırıldı.

Sınırlar: test 60 sn (kullanıcı önbelleği 5 dk; daha uzun testte her kullanıcı 5 dk'da bir yeniden hesaplanır, maliyeti soğuk istekle aynı). Ön yüz (Next.js) bu yolda yok. Tek makine.

## Ölçümle ilgili notlar

- İlk denemede, 300 kullanıcı aynı milisaniyede bağlanınca Windows'un TCP kuyruğu taştı. Bağlantıların ~%0,3'ü reddedildi ("actively refused"). Bu istekler API'ye hiç ulaşmadı, API logunda iz yoktu. Kademeli başlangıçla (5 sn) bu hata kayboldu.
- Ön yüzün (Next.js) kendi dış istekleri bu teste dahil değil. Onlar `frontend/src/lib/externalGate.ts` testleriyle ölçüldü (`npm run test:gate`).
- Tek makinede, gerçek ağ gecikmesi olmadan ölçüldü. Sonuçlar dış kaynak trafiğini doğru gösterir; gerçek sunucudaki cevap süreleri farklı olabilir.

## Tekrar üretmek

```bash
# 1. terminal (backend klasöründe)
go run ./cmd/loadtest -users 300 -duration 60s -funds 16,56,63,64,65,66,116,117,118,119,120
# ban senaryosu için:  ... -block-after 50
# farklı portföylü hesaplar (kopya veritabanında lt001..lt999 hesapları açılmış olmalı):
#   ... -users 1000 -ramp-up 10s -user-prefix lt -user-count 999 -pass <şifre> -portfolio-share 1.0

# 2. terminal (backend klasöründe)
YAHOO_BASE_URL=http://127.0.0.1:9099 TRUSTED_PROXIES=127.0.0.1/32 PORT=8099 \
  DB_URL="postgres://postgres:postgres@127.0.0.1:5432/yarmak?sslmode=disable" go run .
```
