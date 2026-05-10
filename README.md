# YZTA Hackathon Project

KOBİler için yapay zeka destekli operasyon yönetim platformu.

> FastAPI + React 19 + PostgreSQL + MinIO. Tamamen Docker Compose ile ayağa kalkar.

## İçindekiler

- [Stack](#stack)
- [Proje Yapısı](#proje-yapısı)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Servisler](#servisler)
- [API Özeti](#api-özeti)
- [Geliştirme Notları](#geliştirme-notları)
- [Dikkat Edilecek Hususlar](#dikkat-edilecek-hususlar)

## Stack

| Katman          | Teknoloji                                               |
|-----------------|---------------------------------------------------------|
| Backend         | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic   |
| Auth            | JWT (access + refresh), bcrypt, jti blocklist           |
| Frontend        | React 19, Vite, TypeScript, TailwindCSS, react-query    |
| Veritabanı      | PostgreSQL 16                                           |
| Obje deposu     | MinIO (S3 uyumlu, presigned POST policy ile yükleme)    |
| Containerization| Docker / Docker Compose                                 |

## Proje Yapısı

```
.
├── backend/
│   ├── alembic/              Migration'lar
│   └── app/
│       ├── api/              Endpointler (auth, users, uploads)
│       ├── core/             Config, security, rate_limit, middleware
│       ├── db/               Session ve init (alembic upgrade + seed)
│       ├── models/           ORM modelleri (user, token_blocklist)
│       ├── schemas/          Pydantic şemaları + presenter
│       └── services/         İş mantığı (user, token, storage)
├── frontend/
│   └── src/
│       ├── auth/             Auth provider, login/logout, adapters
│       ├── components/       UI bileşenleri
│       ├── i18n/             TR / EN çeviriler
│       ├── layouts/          Sayfa layoutları
│       ├── lib/              API client, helpers
│       ├── pages/            Sayfalar (kobai/, account/, ...)
│       └── routing/          Route tanımları
├── docker-compose.yml
└── .env.example
```

## Hızlı Başlangıç

Gereksinimler: **Docker**, **Docker Compose**, **Git**.

```bash
# 1) Repoyu klonla
git clone https://github.com/<kullanici>/YZTA-Hackathon-Project.git
cd YZTA-Hackathon-Project

# 2) Ortam değişkenlerini kopyala
cp .env.example .env
cp frontend/.env.example frontend/.env

# 3) Servisleri başlat (ilk kez build edilir)
docker compose up --build
```

İlk açılışta:

- Alembic migration'ları otomatik uygulanır (`init_db.run_migrations`).
- Seed kullanıcılar eklenir.

| Kullanıcı   | Şifre      | Rol   |
|-------------|------------|-------|
| yzta-admin  | Yzta123!   | admin |
| yzta-user   | Yzta123!   | user  |

> **Not:** `.env` dosyasındaki `SECRET_KEY` değerini production'a açmadan önce mutlaka uzun rastgele bir değerle değiştir.

## Servisler

| Servis        | URL                          |
|---------------|------------------------------|
| Frontend      | http://localhost:5173        |
| Backend API   | http://localhost:8000/api/v1 |
| Swagger UI    | http://localhost:8000/docs   |
| ReDoc         | http://localhost:8000/redoc  |
| Health        | http://localhost:8000/health |
| MinIO Console | http://localhost:9201        |
| PostgreSQL    | localhost:5433               |

## API Özeti

API prefix: `/api/v1`

| Method | Path                | Auth      | Açıklama                                        |
|--------|---------------------|-----------|-------------------------------------------------|
| POST   | `/auth/register`    | —         | Yeni kullanıcı kaydı                            |
| POST   | `/auth/login`       | —         | OAuth2 password flow (rate-limited)             |
| POST   | `/auth/refresh`     | —         | Access token yenile                             |
| POST   | `/auth/logout`      | bearer    | Access (+opsiyonel refresh) token'ı revoke et   |
| GET    | `/users/me`         | bearer    | Mevcut kullanıcı bilgisi                        |
| PATCH  | `/users/me`         | bearer    | `full_name`, `avatar_key` güncelle              |
| POST   | `/uploads/presigned`| bearer    | S3 POST policy üret (avatars/products/misc)     |
| GET    | `/integrations/whatsapp` | bearer | Bağlı WhatsApp hesabını oku                  |
| POST   | `/integrations/whatsapp` | admin  | WhatsApp Cloud API hesabı bağla              |
| GET/POST | `/integrations/whatsapp/webhook` | — | Meta webhook (verify + receiver)        |
| GET    | `/whatsapp/chat/conversations` | bearer | Sohbet listesi (filter, search, paginated) |
| POST   | `/whatsapp/chat/conversations` | bearer | Yeni sohbet başlat (telefon + mesaj)     |
| GET    | `/whatsapp/chat/conversations/{id}/messages` | bearer | Konuşmadaki mesajlar          |
| POST   | `/whatsapp/chat/conversations/{id}/messages` | bearer | Mesaj gönder (Cloud API)       |
| PATCH  | `/whatsapp/chat/conversations/{id}/status` | bearer | Sohbet durumu (open/pending/closed/spam) |
| PATCH  | `/whatsapp/chat/conversations/{id}/read` | bearer | Okundu işaretle                    |

Hızlı login testi:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=yzta-admin&password=Yzta123!"
```

## Geliştirme Notları

**Migration ekleme.** Modelde değişiklik yaptıktan sonra:

```bash
docker compose exec backend alembic revision --autogenerate -m "add column x"
docker compose exec backend alembic upgrade head
```

> Migration dosyalarını üretildikten sonra mutlaka gözden geçirip commit'le.

**Frontend bağımlılıkları yenileme.**

```bash
docker compose exec frontend npm install
```

**Dosya yükleme akışı.** Frontend `POST /uploads/presigned` ile S3 POST policy alır,
ardından `multipart/form-data` ile doğrudan MinIO'ya yükler. Policy hem `Content-Type`
hem `Content-Length-Range` enforce eder; key her zaman `<prefix>/<user_id>/...` formatındadır,
böylece bir kullanıcı başkasının key'ini referans edemez.

**Rate limiting.** Login endpoint'i in-process sliding-window limiter kullanır
(IP + username başına 5 dakikada 10 deneme). Birden fazla worker / pod ile
çalıştırırsanız Redis tabanlı bir limiter'a (slowapi / fastapi-limiter) geçin.

## Dikkat Edilecek Hususlar

- **`.env`** asla commit'lenmez. `.env.example` referans olarak kullanılır.
- **`SECRET_KEY`** en az 32 karakter ve rastgele olmalı (`openssl rand -hex 32`).
- **MinIO** lokalde public-read policy ile çalışır. Hassas veri yüklenecekse
  policy daraltılmalı ve presigned GET üzerinden okuma yapılmalı.
- **Production** için `ENVIRONMENT=production` set edilmeli (HSTS otomatik aktive olur)
  ve önüne TLS sonlandıran bir reverse proxy (Traefik / Nginx / Caddy) konulmalı.
- **JWT logout** stateless yapıyı korumak için `token_blocklist` tablosu kullanır.
  Tablo zamanla büyür; periyodik olarak `TokenBlocklistService.purge_expired()`
  çağrılmalı (örn. APScheduler veya bir cron job).
- **Branch akışı:** `main` korumalı tutulmalı; özellikler `feat/<konu>` branch'inde
  geliştirilip PR ile birleştirilmeli.
- **Commit mesajları:** [Conventional Commits](https://www.conventionalcommits.org/) önerilir
  (`feat:`, `fix:`, `chore:`, ...).
