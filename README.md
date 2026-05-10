# KobAI — KOBİ / Kooperatif AI Asistanı

Organik gıda kooperatifi için WhatsApp üzerinden müşteri iletişimi, sipariş takibi, stok yönetimi ve AI destekli otomatik yanıt sistemi.

**Demo:** https://kobaitec.com.tr  
**Sektör:** Organik Gıda — Anadolu Doğal Kooperatifi

---

## Özellikler

### 🤖 WhatsApp AI Agent
- **LangGraph** tabanlı multi-agent supervisor pattern
- 5 agent: Supervisor (yönlendirici), Karşılama, Ürün Bilgi, Sipariş, Devir
- Tool-calling ile DB'den gerçek zamanlı veri çekme (ürün arama, sipariş durumu, kargo takip)
- Prompt'lar panelden düzenlenebilir (Panel Ayarları → WhatsApp AI Agentları)
- Sohbet bazında AI açma/kapama toggle'ı
- Escalation: AI çözemezse otomatik canlı temsilciye devir

### 💬 WhatsApp Business Entegrasyonu
- Meta Cloud API ile tam entegrasyon
- Webhook ile gerçek zamanlı inbound mesaj alma
- Outbound mesaj gönderme (panel + AI)
- Otomatik WABA webhook subscription
- Mesaj durumu takibi (sent → delivered → read)

### 📦 Ürün & Stok Yönetimi
- 20 ürünlük organik gıda kataloğu (bal, pekmez, kuruyemiş, peynir, yağ, çay)
- Stok hareketleri (giriş/çıkış/düzeltme)
- Düşük stok uyarıları (eşik bazlı)
- Ürün arama ve filtreleme

### 🛒 Sipariş Yönetimi
- Sipariş oluşturma (otomatik numara üretimi, stok düşme)
- Durum takibi: pending → confirmed → preparing → shipped → delivered
- Sipariş bazında kargo bağlantısı

### 🚚 Kargo Takibi
- Türk kargo firmaları: Aras, Yurtiçi, MNG, PTT
- Takip numarası ve durum yönetimi
- Gecikme tespiti (otomatik delayed işaretleme)

### ✅ Görev Yönetimi
- Paketleme, kargolama, stok yenileme, genel görevler
- Öncelik ve atama sistemi
- Sipariş bağlantılı görevler

### 🔔 Bildirim Sistemi
- Düşük stok, yeni sipariş, kargo gecikmesi, görev atama
- Önem seviyesi: info, warning, critical
- Kullanıcı bazlı + broadcast bildirimler

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic |
| AI | LangChain, LangGraph, Google Gemini |
| Frontend | React 19, TypeScript, TanStack Table, Tailwind CSS |
| Database | PostgreSQL 16 |
| Storage | MinIO (S3-uyumlu) |
| Messaging | WhatsApp Cloud API (Meta) |
| Infra | Docker Compose, Nginx, Cloudflare Tunnel |

---

## Kurulum

```bash
# 1. Repo'yu klonla
git clone <repo-url>
cd YZTA-Hackathon-Project

# 2. .env dosyasını düzenle
cp .env.example .env
# DATABASE_URL, SECRET_KEY, MINIO ayarlarını doldur

# 3. Docker ile başlat
docker compose up -d

# Otomatik olarak:
# - PostgreSQL başlar
# - Migration çalışır (8 migration)
# - Seed data yüklenir (12 müşteri, 20 ürün, 12 sipariş, 11 kargo, 10 görev, 10 bildirim)
# - Backend + Frontend + Nginx ayağa kalkar
```

### Varsayılan Kullanıcılar (Seed)

| Kullanıcı | Şifre | Rol |
|-----------|-------|-----|
| admin | Admin123! | Yönetici |
| depo-ali | Depo123! | Depo Görevlisi |
| kargo-ayse | Kargo123! | Kargo Sorumlusu |
| satis-fatma | Satis123! | Satış |
| muhasebe-hasan | Muhasebe123! | Muhasebe |


## API Endpoints

| Grup | Endpoint | Açıklama |
|------|----------|----------|
| Auth | POST /api/v1/auth/login | JWT login |
| Users | GET /api/v1/users | Kullanıcı listesi |
| Customers | GET/POST /api/v1/customers | Müşteri CRUD |
| Products | GET/POST /api/v1/products | Ürün CRUD |
| Products | GET /api/v1/products/low-stock | Düşük stok |
| Products | POST /api/v1/products/{id}/stock-movements | Stok hareketi |
| Orders | GET/POST /api/v1/orders | Sipariş CRUD |
| Shipments | GET/POST /api/v1/shipments | Kargo CRUD |
| Tasks | GET/POST /api/v1/tasks | Görev CRUD |
| Notifications | GET/POST /api/v1/notifications | Bildirim |
| WhatsApp | GET/POST /api/v1/integrations/whatsapp | WA hesap yönetimi |
| WhatsApp Chat | GET /api/v1/whatsapp/chat/conversations | Sohbet listesi |
| WhatsApp Chat | PATCH .../ai-toggle | AI aç/kapat |
| WhatsApp Chat | DELETE .../conversations/{id} | Sohbet sil |
| AI Agents | GET /api/v1/integrations/ai/agents | Agent listesi |
| AI Agents | PATCH .../agents/{key} | Prompt güncelle |

---

## Proje Yapısı

```
backend/
├── app/
│   ├── agents/          # LangGraph AI agent'ları
│   │   ├── definitions.py   # Agent tanımları + default prompt'lar
│   │   ├── graph.py         # Supervisor + worker graph
│   │   └── tools.py         # DB tool'ları (search, order status, etc.)
│   ├── api/v1/endpoints/    # FastAPI route'ları
│   ├── db/
│   │   ├── seed_data.json   # Demo verisi
│   │   ├── seeder.py        # Seed runner
│   │   └── bootstrap.py     # Migration + seed (entrypoint)
│   ├── models/              # SQLAlchemy modelleri
│   ├── schemas/             # Pydantic şemaları
│   └── services/            # İş mantığı
├── alembic/versions/        # 8 migration dosyası
├── scripts/entrypoint.sh    # Docker entrypoint
└── requirements.txt

frontend/
├── src/
│   ├── pages/kobai/         # Ana uygulama sayfaları
│   │   ├── customers/       # Müşteri listesi
│   │   ├── products/        # Ürün listesi
│   │   ├── orders/          # Sipariş listesi
│   │   ├── shipments/       # Kargo listesi
│   │   ├── tasks/           # Görev listesi
│   │   ├── notifications/   # Bildirim listesi
│   │   ├── inventory/       # Stok hareketleri + düşük stok
│   │   └── settings/        # Ayarlar (agents, users, integrations)
│   ├── pages/messages/whatsapp/  # WhatsApp sohbet paneli
│   ├── config/menu.config.tsx    # Sidebar menü
│   └── i18n/messages/tr.json    # Türkçe çeviriler
└── Dockerfile
```

---

## AI Agent Mimarisi

```
Inbound WhatsApp Mesajı (müşteri → sistem)
        │
        ▼
┌─────────────────┐
│   Supervisor    │  ← Mesajın intent'ini belirler
│  (Yönlendirici) │
└────────┬────────┘
         │ route
    ┌────┼────┬──────────┐
    ▼    ▼    ▼          ▼
┌──────┐┌────────┐┌─────────┐┌──────────┐
│Karşı-││ Ürün   ││ Sipariş ││  Devir   │
│lama  ││ Bilgi  ││ Agent   ││  Agent   │
└──────┘└────────┘└─────────┘└──────────┘
              │         │
              ▼         ▼
         ┌─────────────────┐
         │   DB Tools      │
         │ search_products │
         │ get_order_status│
         │ lookup_customer │
         │ list_orders     │
         └─────────────────┘
              │
              ▼
    WhatsApp Cloud API → Müşteriye otomatik cevap
```

### Akış Detayı

1. Müşteri WhatsApp'tan mesaj atar
2. Meta webhook → backend `/api/v1/integrations/whatsapp/webhook`
3. Mesaj DB'ye kaydedilir (`whatsapp_chat_messages`)
4. Conversation'da `ai_enabled=true` ise → LangGraph agent tetiklenir
5. Supervisor mesajın intent'ini belirler (greeting/product_info/order/escalation)
6. İlgili worker agent tool-calling ile DB'den veri çeker
7. Cevap WhatsApp Cloud API üzerinden müşteriye gönderilir
8. Cevap `is_ai_generated=true` ile DB'ye kaydedilir

### Müşteri Tanıma (WhatsApp → DB)

AI agent, gelen mesajın WhatsApp numarasını (`wa_id`) kullanarak `customers` tablosundaki `whatsapp_id` alanıyla eşleştirir. Müşteri bulunursa siparişleri ve kargo durumu otomatik sorgulanabilir.

---

## Hackathon Görev Eşlemesi

| # | Görev | Durum |
|---|-------|-------|
| 1 | Müşteri İletişimi Otomasyonu (WhatsApp) | ✅ |
| 2 | Ürün ve Sipariş Takibi | ✅ |
| 3 | Kargo Süreçleri | ✅ |
| 4 | Stok / Envanter | ✅ |
| 5 | İş Akışı ve Görev | ✅ |
| 6 | Analitik (opsiyonel) | ⏳ |
| + | AI Agent (LangGraph) | ✅ |
| + | Bildirim Katmanı | ✅ |

---

## Lisans

Hackathon projesi — YZTA 2026.
