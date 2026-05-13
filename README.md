# KobAI — KOBİ / Kooperatif AI Asistanı

Organik gıda kooperatifi için **WhatsApp üzerinden müşteri iletişimi**, **sipariş & kargo takibi**, **stok yönetimi** ve **LangGraph tabanlı çoklu AI ajanı** ile uçtan uca otomasyon paneli.

> **Demo:** https://kobaitec.com.tr  
> **Senaryo:** Anadolu Doğal Organik Gıda Kooperatifi  
> **Repo:** https://github.com/afragul/YZTA-Hackathon-Project

<p align="center">
  <img src="docs/images/banner.png" alt="KobAI banner" width="820" />
</p>

---

## İçindekiler

- [Öne Çıkan Özellikler](#öne-çıkan-özellikler)
- [Teknoloji](#teknoloji)
- [Hızlı Kurulum (5 Dakika)](#hızlı-kurulum-5-dakika)
- [Servisler ve Portlar](#servisler-ve-portlar)
- [Varsayılan Kullanıcılar](#varsayılan-kullanıcılar-seed)
- [API Endpoints](#api-endpoints)
- [Proje Yapısı](#proje-yapısı)
- [AI Ajan Mimarisi](#ai-ajan-mimarisi)
- [Sorun Giderme](#sorun-giderme)
- [Lisans](#lisans)

---

## Öne Çıkan Özellikler

### 🤖 WhatsApp AI Agent (LangGraph Multi-Agent)
- **Supervisor pattern** ile 5 worker ajan: Karşılama, Ürün Bilgi, Sipariş, Devir, Operasyon
- Tool-calling ile DB'den **gerçek zamanlı veri** (ürün arama, sipariş durumu, kargo takip, müşteri)
- Promptlar panelden düzenlenebilir (**Panel Ayarları → WhatsApp AI Agentları**)
- Sohbet bazında **AI aç/kapat** toggle'ı
- Çözülemeyen sorularda otomatik **canlı temsilciye devir**

### 💬 WhatsApp Business Entegrasyonu
- Meta Cloud API ile tam entegrasyon
- Webhook ile gerçek zamanlı **inbound mesaj alma**
- Outbound mesaj gönderme (panel + AI)
- Otomatik WABA webhook subscription
- Mesaj durum takibi (sent → delivered → read)

### 🧠 Akıllı Asistan (Panel Içi Chatbot Widget)
Sağ alt köşede her sayfada hazır duran **"Kobai Asistan"** maskotu (`AssistantWidget`).

- Tek tıkla açılan sohbet penceresi
- Backend `POST /api/v1/assistant/chat` üzerinden çalışır, **DB tool'larını** kullanır
- Sorulabilecek örnekler: *"Kaç bekleyen siparişim var?"*, *"Bugünkü satış toplamı ne?"*, *"Düşük stoktaki ürünler hangileri?"*, *"Geciken kargo var mı?"*
- Stateless: konuşma geçmişi her istekte gönderilir, anında cevap döner

### 🎯 Ürün Öneri Sistemi (WhatsApp)
Müşteriye gerçek zamanlı, **tool-calling tabanlı** ürün önerisi.

- Ürün Bilgi ajanı (`product_info`) müşterinin doğal dildeki sorusuna göre `search_products` tool'unu çağırır
- Stok durumu, fiyat ve kategori verisini **canlı DB**'den çeker
- Sadece stokta olan ürünleri önerir, "stokta mevcut / yok" mantığıyla cevap verir
- Mesaja `*kalın*` formatlamayla ürün isimlerini vurgular (WhatsApp markdown)
- Müşteri sepetini siparişe çevirmek istediğinde Sipariş ajanına devreder

### 📊 AI Stok Önerileri (Analitik Ajanı)
**Stok / AI Stok Önerileri** sayfası — düşük stoğa yaklaşan ürünler için AI destekli aksiyon önerisi.

- Backend formülü: günlük ortalama satış × tedarik süresi → **önerilen sipariş miktarı**
- Analitik ajanı bu sayısal veriyi alır, **operasyonel mesaja ve tedarikçi mail taslağına** dönüştürür
- Sonuç kart UI'da: mevcut stok, günlük satış, tedarik süresi, tükenmeye kalan gün
- "Mail taslağını gör" → tedarikçiye gönderilebilecek hazır içerik (kopyala / mail uygulamasında aç)
- Endpoint: `GET /api/v1/products/ai-stock-suggestions`

### ⚙️ AI İş Akışı Otomasyonu (Operasyon Ajanı)
**Görevler** sayfasındaki *"AI İş Akışını Tetikle"* butonu — operasyonel günlük rutini ajana devret.

- Bekleyen siparişleri / işleri Operasyon Ajanı'na yollar
- Ajan tool-calling ile yeni görev oluşturur, atar, durumları günceller
- Sonunda yapılan işlerin **AI özetini** geri döndürür
- Endpoint: `POST /api/v1/tasks/run-ai-workflow`

### 🔍 AI Ürün Veri Kontrolü
Ürün listesinden tek tıkla **veri tutarlılık denetimi**.

- Eksik açıklama, kategori uyumsuzluğu, fiyat anomalisi tespiti
- Sonuç modal'da puan + öneri olarak gösterilir
- Endpoint: `POST /api/v1/products/{id}/ai-data-check`

### 📦 Ürün & Stok Yönetimi
- 20 ürünlük organik gıda kataloğu (bal, pekmez, kuruyemiş, peynir, yağ, çay)
- Stok hareketleri (giriş / çıkış / düzeltme)
- Düşük stok uyarıları (eşik bazlı)
- Ürün arama, filtreleme ve kategori bazlı listeleme

### 🛒 Sipariş Yönetimi
- Sipariş oluşturma (otomatik numara, stok düşme)
- Durum akışı: `pending → confirmed → preparing → shipped → delivered`
- Sipariş bazında kargo bağlantısı

### 🚚 Kargo Takibi
- Türk kargo firmaları: Aras, Yurtiçi, MNG, PTT
- Takip numarası, ETA, durum yönetimi
- Otomatik **gecikme tespiti** (delayed işaretleme) ve gecikmiş kargolar için müşteriye **otomatik bilgilendirme** akışı

### ✅ Görev Yönetimi
- Paketleme, kargolama, stok yenileme, genel görevler
- Öncelik & atama sistemi
- Sipariş bağlantılı görevler
- AI ajanı ile **otomatik görev üretimi** (yukarıdaki "AI İş Akışı Otomasyonu")

### 📧 Brevo E-posta Entegrasyonu
- Ayarlar → Entegrasyonlar → E-posta üzerinden bağlanma
- API anahtarı **şifreli** olarak DB'de saklanır (Fernet)
- Bağlantı testi + test e-postası gönderme akışı
- Stok önerilerinden gelen mail taslakları doğrudan kullanılabilir

### 🔔 Bildirim Sistemi
- Düşük stok, yeni sipariş, kargo gecikmesi, görev atama
- Önem seviyeleri: `info / warning / critical`
- Kullanıcı bazlı + broadcast bildirimler

## Teknoloji

| Katman    | Teknoloji |
|-----------|-----------|
| Backend   | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| AI        | LangChain, LangGraph, Google Gemini |
| Frontend  | React 19, TypeScript, Vite, TanStack Table, Tailwind CSS |
| Database  | PostgreSQL 16 |
| Storage   | MinIO (S3-uyumlu) |
| Messaging | WhatsApp Cloud API (Meta), Brevo (e-posta) |
| Infra     | Docker Compose, Nginx, Cloudflare Tunnel |

---

## Hızlı Kurulum (5 Dakika)

### Ön Koşullar

- **Git** ([indir](https://git-scm.com/downloads))
- **Docker Desktop** ([indir](https://www.docker.com/products/docker-desktop)) — Compose dahil
- 4 GB boş RAM, 2 GB boş disk

> Backend & frontend için Node / Python yerel kurulumuna **gerek yok** — her şey Docker içinde çalışır.

### Adım 1 — Repoyu klonla

```bash
git clone https://github.com/afragul/YZTA-Hackathon-Project.git
cd YZTA-Hackathon-Project
```

### Adım 2 — `.env` dosyasını oluştur

**Linux / macOS:**
```bash
cp .env.example .env
```

**Windows (cmd):**
```cmd
copy .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

> Hızlı başlangıç için varsayılan değerler yeterli. WhatsApp / Gemini denemek istiyorsanız `.env` içinde ilgili anahtarları doldurun (aşağıdaki [Opsiyonel Yapılandırma](#opsiyonel-yapılandırma) bölümüne bakın).

### Adım 3 — Docker ile başlat

```bash
docker compose up -d --build
```

İlk kalkışta otomatik olarak:
- ✅ PostgreSQL ayağa kalkar
- ✅ Alembic migration'ları çalışır (9 migration)
- ✅ Seed data yüklenir (12 müşteri, 20 ürün, 12 sipariş, 11 kargo, 10 görev, 10 bildirim)
- ✅ Backend, Frontend, MinIO, Nginx servisleri başlar

### Adım 4 — Aç

| Adres | Servis |
|-------|--------|
| http://localhost:8080 | Nginx (tek giriş — önerilen) |
| http://localhost:5173 | Frontend (doğrudan) |
| http://localhost:8000/docs | Backend Swagger UI |
| http://localhost:9201 | MinIO Console (`kobai_minio` / `kobai_minio_pass`) |

İlk girişte `admin / Admin123!` ile oturum açın.

### Logları izle / durdur

```bash
docker compose logs -f backend     # backend logları
docker compose logs -f frontend    # frontend logları
docker compose ps                  # servis durumu
docker compose down                # durdur
docker compose down -v             # durdur + verileri sil (sıfırdan başla)
```

### Opsiyonel Yapılandırma

`.env` içinde aşağıdakileri doldurursanız ek özellikler aktif olur:

```dotenv
# AI cevapları için (yoksa AI ajanları çalışmaz)
GOOGLE_API_KEY=AIza...

# WhatsApp Cloud API webhooks için (Meta App + WABA gerekli)
WHATSAPP_PUBLIC_WEBHOOK_BASE=https://your-tunnel.trycloudflare.com

# Public erişim için Cloudflare Tunnel (opsiyonel)
CLOUDFLARE_TUNNEL_TOKEN=...
```

E-posta (Brevo) entegrasyonu için **API key panelden** girilir, `.env`'e koymanıza gerek yoktur.

---

## Servisler ve Portlar

`docker-compose.yml` aşağıdaki servisleri ayağa kaldırır:

| Servis | İmaj | Host Portu | Konteyner Portu |
|--------|------|-----------:|----------------:|
| `db` | postgres:16-alpine | 5433 | 5432 |
| `backend` | local build (`./backend`) | 8000 | 8000 |
| `frontend` | local build (`./frontend`) | 5173 | 80 |
| `minio` | minio:RELEASE.2024-12-18 | 9200 / 9201 | 9000 / 9001 |
| `nginx` | nginx:alpine | 8080 | 80 |
| `cloudflared` | cloudflare/cloudflared | — | — |

---

## Varsayılan Kullanıcılar (Seed)

| Kullanıcı | Şifre | Rol |
|-----------|-------|-----|
| admin | `Admin123!` | Yönetici |
| depo-ali | `Depo123!` | Depo Görevlisi |
| kargo-ayse | `Kargo123!` | Kargo Sorumlusu |
| satis-fatma | `Satis123!` | Satış |
| muhasebe-hasan | `Muhasebe123!` | Muhasebe |

---

## API Endpoints

| Grup | Endpoint | Açıklama |
|------|----------|----------|
| Auth | `POST /api/v1/auth/login` | JWT login |
| Users | `GET /api/v1/users` | Kullanıcı listesi |
| Customers | `GET/POST /api/v1/customers` | Müşteri CRUD |
| Products | `GET/POST /api/v1/products` | Ürün CRUD |
| Products | `GET /api/v1/products/low-stock` | Düşük stok |
| Products | `GET /api/v1/products/ai-stock-suggestions` | AI stok öneri listesi |
| Products | `POST /api/v1/products/{id}/ai-data-check` | AI ürün veri kontrolü |
| Products | `POST /api/v1/products/{id}/stock-movements` | Stok hareketi |
| Orders | `GET/POST /api/v1/orders` | Sipariş CRUD |
| Shipments | `GET/POST /api/v1/shipments` | Kargo CRUD |
| Tasks | `GET/POST /api/v1/tasks` | Görev CRUD |
| Tasks | `POST /api/v1/tasks/run-ai-workflow` | AI iş akışı tetikleyici |
| Notifications | `GET/POST /api/v1/notifications` | Bildirim |
| Dashboard | `GET /api/v1/dashboard/stats` | KPI özeti |
| Assistant | `POST /api/v1/assistant/chat` | Admin AI chatbot |
| WhatsApp | `GET/POST /api/v1/integrations/whatsapp` | WA hesap yönetimi |
| WhatsApp Chat | `GET /api/v1/whatsapp/chat/conversations` | Sohbet listesi |
| WhatsApp Chat | `PATCH .../ai-toggle` | AI aç / kapat |
| WhatsApp Chat | `DELETE .../conversations/{id}` | Sohbet sil |
| AI Agents | `GET /api/v1/integrations/ai/agents` | Agent listesi |
| AI Agents | `PATCH .../agents/{key}` | Prompt güncelle |
| Email | `POST /api/v1/integrations/email` | Brevo hesabı bağla |
| Email | `POST .../email/{id}/test` | Bağlantı testi |
| Email | `POST .../email/{id}/send-test` | Test e-postası |

Tüm endpoint'leri canlı görmek için: **http://localhost:8000/docs**

---

## Proje Yapısı

```
backend/
├── app/
│   ├── agents/                # LangGraph AI ajanları
│   │   ├── definitions.py     # Ajan tanımları + default promptlar
│   │   ├── graph.py           # Supervisor + worker graph
│   │   ├── tools.py           # WhatsApp ajan tool'ları
│   │   ├── operation_tools.py # Operasyon ajan tool'ları
│   │   └── admin_tools.py     # Admin asistan tool'ları
│   ├── api/v1/endpoints/      # FastAPI route'ları
│   ├── db/
│   │   ├── seed_data.json     # Demo verisi
│   │   ├── seeder.py          # Seed runner
│   │   └── bootstrap.py       # Migration + seed (entrypoint)
│   ├── models/                # SQLAlchemy modelleri
│   ├── schemas/               # Pydantic şemaları
│   └── services/              # İş mantığı (email, ai, whatsapp, ...)
├── alembic/versions/          # 9 migration dosyası
├── scripts/entrypoint.sh      # Docker entrypoint
└── requirements.txt

frontend/
├── src/
│   ├── pages/kobai/           # Ana uygulama sayfaları (modüler)
│   │   ├── customers/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── shipments/
│   │   ├── tasks/
│   │   ├── notifications/
│   │   ├── inventory/
│   │   ├── dashboard/
│   │   └── settings/          # AI agentları, kullanıcılar, entegrasyonlar
│   ├── pages/messages/whatsapp/   # WhatsApp sohbet paneli
│   ├── config/menu.config.tsx     # Sidebar menü
│   └── i18n/messages/tr.json      # Türkçe çeviriler
└── Dockerfile

docs/
├── hackathon-db-schema.md
```
---

## AI Ajan Mimarisi

```
Inbound WhatsApp Mesajı (müşteri → sistem)
        │
        ▼
┌─────────────────┐
│   Supervisor    │  ← Mesajın intent'ini belirler
│  (Yönlendirici) │
└────────┬────────┘
         │ route
    ┌────┼────┬────────┬──────────┐
    ▼    ▼    ▼        ▼          ▼
┌──────┐┌──────┐┌────────┐┌─────────┐┌──────────┐
│Karşı-││Ürün  ││Sipariş ││Operasyon││  Devir   │
│lama  ││Bilgi ││ Agent  ││  Agent  ││  Agent   │
└──────┘└──────┘└────────┘└─────────┘└──────────┘
              │       │        │
              ▼       ▼        ▼
         ┌─────────────────────────────┐
         │         DB Tools            │
         │ search_products             │
         │ get_order_status            │
         │ lookup_customer             │
         │ list_orders                 │
         │ list_shipments              │
         │ low_stock / system_overview │
         └─────────────────────────────┘
              │
              ▼
    WhatsApp Cloud API → Müşteriye otomatik cevap
```

### Akış Detayı

1. Müşteri WhatsApp'tan mesaj atar
2. Meta webhook → backend `/api/v1/integrations/whatsapp/webhook`
3. Mesaj DB'ye kaydedilir (`whatsapp_chat_messages`)
4. Conversation'da `ai_enabled=true` ise → LangGraph ajanı tetiklenir
5. Supervisor mesajın intent'ini belirler (greeting / product_info / order / operation / escalation)
6. İlgili worker ajan tool-calling ile DB'den veri çeker
7. Cevap WhatsApp Cloud API üzerinden müşteriye gönderilir
8. Cevap `is_ai_generated=true` ile DB'ye kaydedilir

### Müşteri Tanıma (WhatsApp → DB)

AI ajanı, gelen mesajın WhatsApp numarasını (`wa_id`) kullanarak `customers` tablosundaki `whatsapp_id` alanıyla eşleştirir. Müşteri bulunursa siparişleri ve kargo durumu otomatik sorgulanabilir.

### Yan Ajanlar

- **Admin AI Asistanı:** Panel sahibinin sorduğu soruları (sipariş sayısı, satış, düşük stok, gecikmiş kargo) DB tool'larıyla cevaplar. Stateless — geçmişi frontend yollar.
- **Analitik / Stok Öneri Ajanı:** Satış trendine göre stok ve fiyatlama önerisi üretir.
- **Ürün Veri Kontrol Ajanı:** Katalogdaki ürünleri tarar, eksik / tutarsız alanları işaretler.

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `docker compose up` build hatası veriyor | `docker system prune -a` çalıştırın, sonra tekrar deneyin |
| 8000 / 5173 / 5433 portları dolu | `.env` içinde portu değiştirin **veya** çakışan servisi kapatın |
| Frontend açılıyor ama API çağrıları 502 | `docker compose logs backend` — migration / DB hatasını kontrol edin |
| Sıfırdan başlamak istiyorum | `docker compose down -v && docker compose up -d --build` |
| WhatsApp webhook ulaşmıyor | `WHATSAPP_PUBLIC_WEBHOOK_BASE` public bir HTTPS URL olmalı (Cloudflare Tunnel önerilir) |


## Lisans

Hackathon projesi — **YZTA 2026**.
