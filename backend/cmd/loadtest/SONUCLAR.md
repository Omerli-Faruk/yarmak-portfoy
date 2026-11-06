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

## Ölçümle ilgili notlar

- İlk denemede, 300 kullanıcı aynı milisaniyede bağlanınca Windows'un TCP kuyruğu taştı. Bağlantıların ~%0,3'ü reddedildi ("actively refused"). Bu istekler API'ye hiç ulaşmadı, API logunda iz yoktu. Kademeli başlangıçla (5 sn) bu hata kayboldu.
- Ön yüzün (Next.js) kendi dış istekleri bu teste dahil değil. Onlar `frontend/src/lib/externalGate.ts` testleriyle ölçüldü (`npm run test:gate`).
- Tek makinede, gerçek ağ gecikmesi olmadan ölçüldü. Sonuçlar dış kaynak trafiğini doğru gösterir; gerçek sunucudaki cevap süreleri farklı olabilir.

## Tekrar üretmek

```bash
# 1. terminal (backend klasöründe)
go run ./cmd/loadtest -users 300 -duration 60s -funds 16,56,63,64,65,66,116,117,118,119,120
# ban senaryosu için:  ... -block-after 50

# 2. terminal (backend klasöründe)
YAHOO_BASE_URL=http://127.0.0.1:9099 TRUSTED_PROXIES=127.0.0.1/32 PORT=8099 \
  DB_URL="postgres://postgres:postgres@127.0.0.1:5432/yarmak?sslmode=disable" go run .
```
