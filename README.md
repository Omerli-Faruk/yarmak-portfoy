<div align="center">

<img src="frontend/public/logo.png" alt="Yarmak" width="88" />

# Yarmak

Borsa İstanbul hisseleri, TEFAS fonları, altın ve döviz için portföy takip uygulaması.

</div>

Alım-satımlarınızı elle girersiniz; uygulama ortalama maliyeti, gerçekleşen ve gerçekleşmeyen kâr/zararı, temettüleri ve portföyün zaman içindeki değerini hesaplar. Banka veya aracı kurum hesabına bağlanmaz, yatırım tavsiyesi vermez.

## Özellikler

- Hisse, fon, gram altın ve döviz aynı portföyde
- Komisyon dahil ağırlıklı ortalama maliyet, gerçekleşen/gerçekleşmeyen kâr-zarar
- Bedelsiz ve ters bölünmeler geçmiş işlemlere yansıtılır
- Temettü kaydı ve stopaj hesabı
- Günlük portföy değeri kaydı ve dönemsel getiri grafikleri
- Fiyat alarmları
- Piyasa ekranı: endeksler, günün en çok yükselen/düşenleri, varlık tarayıcı
- TL / USD görünümü (güncel USD/TRY kuru ile)

## Hızlı başlangıç

Gereken tek şey [Docker](https://docs.docker.com/get-docker/) (Docker Desktop ya da Docker Engine + Compose v2).

```bash
git clone https://github.com/Omerli-Faruk/yarmak-portfoy.git
cd yarmak-portfoy
docker compose up -d --build
```

İlk derleme birkaç dakika sürer. Sonra:

| | Adres |
| --- | --- |
| Arayüz | http://localhost:3000 |
| API | http://localhost:8080/v1 |
| Swagger | http://localhost:8080/swagger/index.html |

Veritabanı boş başlar. BIST 100 hisseleri ve sık kullanılan TEFAS fonlarının listesini yüklemek için:

```bash
docker compose run --rm seed
```

Hazır işlemleri olan bir hesapla denemek isterseniz demo hesabını oluşturun ve `demo` / `demo12345` ile giriş yapın:

```bash
docker compose run --rm demo_seed
```

Fonların geçmiş fiyatları ilk açılışta yoktur; bir fon görüntülendiğinde arka planda indirilir. Tüm fonların 5 yıllık geçmişini baştan indirmek için (20-30 dakika sürer):

```bash
docker compose run --rm deep_seeder
```

Durdurmak için `docker compose down`, veritabanını da silmek için `docker compose down -v`.

### Veriler nerede duruyor?

Kullanıcılar, işlemler ve fiyat geçmişi yalnızca sizin bilgisayarınızdaki Docker volume'unda (`yarmak_postgres_data`) tutulur. Repoda veritabanı dökümü yoktur; her kurulum boş bir veritabanıyla başlar ve fiyatları aşağıdaki kaynaklardan kendisi çeker.

## Yapılandırma

Docker ile çalıştırırken hiçbir ayar zorunlu değildir. Değiştirmek istediğiniz değerler için:

```bash
cp .env.example .env
```

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres` / `yarmak` | Veritabanı bilgileri |
| `DB_PORT` / `PORT` / `FRONTEND_PORT` | `5432` / `8080` / `3000` | Bilgisayarda açılan portlar. Veritabanı yalnızca `127.0.0.1` üzerinden erişilebilir. |
| `JWT_SECRET` | boş | Boşsa API her açılışta geçici bir anahtar üretir. Sunucuda `openssl rand -hex 32` ile kalıcı bir anahtar verin. |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | API'nin kabul ettiği arayüz adresleri (CORS) |
| `COOKIE_SECURE` | `false` | HTTPS arkasında `true` olmalı |
| `ENABLE_SWAGGER` | `true` | Swagger arayüzünü kapatmak için `false` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/v1` | Tarayıcının API adresi. Derleme anında koda gömülür, değiştirince `docker compose up -d --build frontend` gerekir. |

Bu ayarlarla kurulum yerel kullanım içindir. İnternete açık bir sunucuda çalıştıracaksanız en azından `JWT_SECRET`, `POSTGRES_PASSWORD`, `COOKIE_SECURE=true` ve `ENABLE_SWAGGER=false` ayarlayın ve önüne HTTPS sağlayan bir ters proxy koyun.

## Docker olmadan geliştirme

Gereksinimler: Go 1.25+, Node.js 22, PostgreSQL 16 ve [goose](https://github.com/pressly/goose). Veritabanını Docker'da çalıştırmak en kolayı:

```bash
docker compose up -d db
```

Backend:

```bash
cd backend
cp .env.example .env
goose -dir sql/schema postgres "postgres://postgres:postgres@localhost:5432/yarmak?sslmode=disable" up
go run ./cmd/seed     # varlık listesi (isteğe bağlı)
go run .              # http://localhost:8080
```

Frontend:

```bash
cd frontend
npm ci
npm run dev           # http://localhost:3000
```

SQL sorgularını değiştirdikten sonra `backend` klasöründe `sqlc generate`, handler açıklamalarını değiştirdikten sonra `swag init` çalıştırın.

## Nasıl çalışıyor?

`docker compose up` sırasıyla PostgreSQL'i başlatır, `backend/sql/schema` altındaki migration'ları goose ile uygular, ardından API'yi ve arayüzü açar.

API tek bir Go süreci olarak çalışır ve fiyatları arka planda günceller:

- BIST, altın ve döviz: iş günlerinde 10:00-18:15 arasında 5 dakikada bir
- TEFAS fonları: sabah 09:00'da ve akşam 18:00-21:00 arasında
- Eksik fon geçmişi: kuyruktaki fonlar sırayla indirilir
- Portföy değeri: her gün 18:00'den sonra bir kez kaydedilir

Next.js tarafındaki `/api/*` rotaları piyasa ekranı ve varlık detayı için Yahoo Finance verisini sunucu tarafında çeker ve kısa süreli önbellekte tutar.

Ortalama maliyet hesabı `backend/internal/wac` paketinde tek yerde durur; hem API hem de günlük portföy kaydı bunu kullanır.

### Veri kaynakları

Fiyatlar herkese açık sayfalardan ve servislerden çekilir: TEFAS, Yahoo Finance, Bigpara, Google Finance ve Truncgil. Bu kaynakların resmi bir API sözleşmesi yoktur; biçimleri değişirse ilgili çekici bozulabilir. Proje kişisel ve eğitim amaçlıdır; verileri ticari olarak kullanmadan önce her kaynağın kullanım koşullarına bakın.

## API

Tüm uç noktalar `/v1` altındadır; ayrıntılar Swagger arayüzündedir. Kimlik doğrulama HttpOnly çerezlerle yapılır.

| Grup | Uç noktalar |
| --- | --- |
| Hesap | `POST /register`, `POST /login`, `POST /refresh`, `POST /revoke`, `GET /me` |
| Varlıklar | `GET /assets`, `GET /assets/lookup`, `GET /assets/daily-changes`, `GET /assets/{id}/summary`, `GET /assets/{id}/price-history`, `POST /assets/{id}/backfill` |
| İşlemler | `GET/POST /transactions`, `PUT/DELETE /transactions/{id}` |
| Portföy | `GET /portfolio/holdings`, `GET /portfolio/summary`, `GET /portfolio/history`, `GET /portfolio/value-history`, `DELETE /portfolio/holdings/{symbol}` |
| Temettü | `GET/POST /dividends`, `PUT/DELETE /dividends/{id}` |
| Alarmlar | `GET/POST /alerts`, `DELETE /alerts/{id}` |
| Yönetici | `POST /assets`, `POST /splits`, `GET /assets/{id}/splits` |
| Sağlık | `GET /healthz` |

Sistemde olmayan bir sembol `GET /assets/lookup` ile yalnızca giriş yapmış kullanıcılar için dış kaynaklardan aranıp eklenir.

## Proje yapısı

```
.
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── main.go              # HTTP sunucusu ve arka plan işleri
│   ├── cmd/
│   │   ├── seed/            # varlık listesi ve demo hesabı
│   │   ├── tefas_deep_seeder/
│   │   └── tefas_sync/      # elle fon kataloğu/geçmiş senkronizasyonu
│   ├── internal/
│   │   ├── auth/            # JWT, parola, refresh token
│   │   ├── database/        # sqlc ile üretilen kod
│   │   ├── handlers/        # HTTP handler'ları
│   │   ├── router/          # rotalar, CORS, rate limit
│   │   ├── scraper/         # fiyat çekiciler ve zamanlanmış işler
│   │   ├── services/        # portföy, işlem ve varlık mantığı
│   │   └── wac/             # ağırlıklı ortalama maliyet
│   ├── sql/schema/          # goose migration'ları
│   ├── sql/queries/         # sqlc sorguları
│   └── docs/                # Swagger (swag ile üretilir)
└── frontend/
    └── src/
        ├── app/             # sayfalar ve /api rotaları
        ├── components/
        ├── context/ hooks/
        └── lib/
```

## Testler

Backend (`backend` klasöründe):

```bash
go test -race ./...
```

Frontend (`frontend` klasöründe):

```bash
npx next typegen && npx tsc --noEmit && npm run lint
```

GitHub Actions her push ve pull request'te backend için golangci-lint, testler ve derlemeyi; frontend için tip kontrolü, lint ve derlemeyi çalıştırır.

## Lisans

[MIT](LICENSE)

<sub>Yarmak bir yatırım tavsiyesi aracı değildir. Gösterilen fiyatlar gecikmeli veya hatalı olabilir.</sub>
