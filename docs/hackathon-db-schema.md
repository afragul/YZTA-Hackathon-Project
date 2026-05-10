# Hackathon Mini DB Şeması — KOBİ / Kooperatif AI Asistanı

Bu doküman, mevcut altyapı (PostgreSQL + SQLAlchemy 2.0 + Alembic, `Base` + `TimestampMixin`, `users` tablosu) üzerine eklenecek **minimum çekirdek şemayı** tanımlar. Hackathon görev kırılımı:

- (1) Müşteri İletişiminin Otomasyonu
- (2) Ürün ve Sipariş Takibi
- (3) Kargo Süreçleri
- (4) Stok / Envanter
- (5) İş Akışı ve Görev
- (6) Analitik (opsiyonel)
- (+) Bildirim katmanı (tüm modüller için ortak)

Amaç: Az tablo, net ilişkiler, AI ajanının (RAG + tool calling) doğrudan sorgulayıp aksiyon alabileceği bir model.

---

## 1. Genel İlkeler

- Tüm tablolar `id BIGSERIAL PK` + `created_at`, `updated_at` (TimestampMixin) taşır.
- Para alanları `NUMERIC(12, 2)`, miktarlar (stok) `NUMERIC(12, 3)` (kg / litre desteği için).
- Tüm enum'lar PostgreSQL native `ENUM` (mevcut `user_role` paterniyle uyumlu).
- Soft-delete kullanılmaz (hackathon scope, basit tutuluyor).
- Çoklu tenant yok; tek işletme varsayımı (gerekirse `business_id` eklenebilir).
- AI ajanı için kritik alanlar: `orders.status`, `shipments.status`, `products.stock`, `notifications`, `agent_messages`.

---

## 2. ER Özeti

```
users (mevcut)
  └─< tasks.assignee_id
  └─< notifications.user_id
  └─< agent_conversations.handled_by_user_id

customers
  └─< orders
  └─< agent_conversations
       └─< agent_messages
            ├─< whatsapp_media           (1-N, genelde 1-1)
            └─→ whatsapp_templates       (outbound template için)

whatsapp_webhook_events  (ham log, async işlenir; agent_messages.provider_message_id ile bağlanır)

products
  └─< order_items
  └─< stock_movements

orders
  ├─< order_items
  └─1 shipment

shipments  (1-1 orders)
```

---

## 3. Tablolar

### 3.1 `customers` — (1) Müşteri İletişimi & (2) Sipariş

İşletmenin son müşterileri. WhatsApp / e-posta / telefon kanallarından gelen kişiler burada tekilleştirilir. WhatsApp Business API'de müşteri kimliği `wa_id`'dir (E.164 format, başında `+` yok). `phone` ile aynı olabilir ama platform tarafından kanonikleştirilmiş halidir; ayrı tutmak idempotency için güvenli.

| Sütun                  | Tip                | Notlar                                                                |
| ---------------------- | ------------------ | --------------------------------------------------------------------- |
| `id`                   | BIGSERIAL PK       |                                                                       |
| `full_name`            | VARCHAR(120)       | NOT NULL — webhook'tan `profile.name` ile gelir, sonradan düzenlenebilir |
| `phone`                | VARCHAR(32)        | NULLABLE, INDEX — kullanıcının yazdığı / panelden girilen ham numara  |
| `whatsapp_id`          | VARCHAR(32)        | UNIQUE, INDEX — WhatsApp `wa_id` (ör. `905551234567`)                 |
| `whatsapp_profile_name`| VARCHAR(120)       | NULLABLE — webhook'tan gelen anlık profil adı                         |
| `whatsapp_opt_in`      | BOOLEAN            | NOT NULL, default FALSE — proaktif (template) mesaj izni              |
| `email`                | VARCHAR(255)       | NULLABLE, INDEX                                                       |
| `address`              | TEXT               | NULLABLE                                                              |
| `city`                 | VARCHAR(80)        | NULLABLE                                                              |
| `notes`                | TEXT               | Serbest not (AI özetleri burada tutulabilir)                          |
| `created_at`           | TIMESTAMPTZ        |                                                                       |
| `updated_at`           | TIMESTAMPTZ        |                                                                       |

İndeksler: `(whatsapp_id) UNIQUE`, `(phone)`, `(email)`.

> Webhook geldiğinde upsert mantığı: önce `whatsapp_id` ile ara, yoksa yeni `customer` oluştur. Bu sayede aynı müşteri tekrar yazdığında ikinci kayıt açılmaz.

---

### 3.2 `products` — (2) Ürün & (4) Stok

| Sütun             | Tip                 | Notlar                                                                |
| ----------------- | ------------------- | --------------------------------------------------------------------- |
| `id`              | BIGSERIAL PK        |                                                                       |
| `sku`             | VARCHAR(64)         | UNIQUE, INDEX                                                         |
| `name`            | VARCHAR(200)        | INDEX (LIKE / trigram opsiyonel)                                      |
| `description`     | TEXT                | NULLABLE — RAG için kaynak                                            |
| `category`        | VARCHAR(80)         | NULLABLE — `domates`, `bal`, `el-yapımı` vb.                          |
| `unit`            | ENUM `product_unit` | `piece`, `kg`, `lt`, `pack`                                           |
| `price`           | NUMERIC(12,2)       | NOT NULL, default 0                                                   |
| `stock`           | NUMERIC(12,3)       | NOT NULL, default 0 — anlık seviye (denormalize)                      |
| `low_stock_threshold` | NUMERIC(12,3)   | NOT NULL, default 0 — uyarı eşiği (4. madde)                          |
| `is_active`       | BOOLEAN             | NOT NULL, default TRUE                                                |
| `image_key`       | VARCHAR(512)        | NULLABLE — mevcut storage_service ile uyumlu                          |
| `created_at` / `updated_at` | TIMESTAMPTZ |                                                                       |

İndeksler: `(sku) UNIQUE`, `(name)`, `(category)`, `(is_active)`.

> Not: `stock` alanı her `stock_movement` insert'inde transaction içinde güncellenir. Tek kaynak gerçeği `stock_movements` toplamıdır; `products.stock` performans için cache.

---

### 3.3 `stock_movements` — (4) Envanter Hareketleri

Her stok değişimi (giriş, çıkış, sayım düzeltmesi) burada loglanır. AI ajanı "geçmiş tüketim" ve "yenileme önerisi" için bu tabloyu okur.

| Sütun          | Tip                          | Notlar                                                  |
| -------------- | ---------------------------- | ------------------------------------------------------- |
| `id`           | BIGSERIAL PK                 |                                                         |
| `product_id`   | BIGINT FK → products.id      | NOT NULL, INDEX, ON DELETE RESTRICT                     |
| `movement_type`| ENUM `stock_movement_type`   | `in`, `out`, `adjustment`                               |
| `quantity`     | NUMERIC(12,3)                | NOT NULL — pozitif değer (yön `movement_type` ile belli)|
| `reason`       | VARCHAR(120)                 | `order:{id}`, `restock`, `correction`, `loss`           |
| `order_id`     | BIGINT FK → orders.id        | NULLABLE — sipariş kaynaklı çıkışlar için               |
| `created_at`   | TIMESTAMPTZ                  |                                                         |

İndeksler: `(product_id, created_at)`, `(order_id)`.

---

### 3.4 `orders` — (2) Sipariş

| Sütun             | Tip                       | Notlar                                                                |
| ----------------- | ------------------------- | --------------------------------------------------------------------- |
| `id`              | BIGSERIAL PK              |                                                                       |
| `order_number`    | VARCHAR(32)               | UNIQUE, INDEX — kullanıcıya gösterilen kısa kod (ör. `ORD-2026-0128`) |
| `customer_id`     | BIGINT FK → customers.id  | NOT NULL, INDEX                                                       |
| `status`          | ENUM `order_status`       | `pending`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled` |
| `total_amount`    | NUMERIC(12,2)             | NOT NULL, default 0 — order_items toplamından hesap                   |
| `currency`        | CHAR(3)                   | default `'TRY'`                                                       |
| `note`            | TEXT                      | NULLABLE — müşteri notu                                               |
| `created_at` / `updated_at` | TIMESTAMPTZ     |                                                                       |

İndeksler: `(order_number) UNIQUE`, `(customer_id, created_at)`, `(status, created_at)`.

> AI ajanı için temel sorgular:
> - "128 numaralı siparişim ne zaman gelir?" → `order_number = 'ORD-2026-0128'` JOIN `shipments`.
> - "bugünün siparişleri" → `WHERE created_at::date = CURRENT_DATE`.

---

### 3.5 `order_items` — (2) Sipariş Kalemleri

| Sütun         | Tip                       | Notlar                                              |
| ------------- | ------------------------- | --------------------------------------------------- |
| `id`          | BIGSERIAL PK              |                                                     |
| `order_id`    | BIGINT FK → orders.id     | NOT NULL, INDEX, ON DELETE CASCADE                  |
| `product_id`  | BIGINT FK → products.id   | NOT NULL, INDEX, ON DELETE RESTRICT                 |
| `quantity`    | NUMERIC(12,3)             | NOT NULL                                            |
| `unit_price`  | NUMERIC(12,2)             | NOT NULL — sipariş anındaki fiyat (snapshot)        |
| `subtotal`    | NUMERIC(12,2)             | NOT NULL — `quantity * unit_price`                  |

İndeksler: `(order_id)`, `(product_id)`. UNIQUE `(order_id, product_id)` — aynı üründen tek satır.

---

### 3.6 `shipments` — (3) Kargo

Her sipariş için 1-1 kargo kaydı. `tracking_number` yoksa null kalır (henüz kargoya verilmemiş).

| Sütun               | Tip                        | Notlar                                                              |
| ------------------- | -------------------------- | ------------------------------------------------------------------- |
| `id`                | BIGSERIAL PK               |                                                                     |
| `order_id`          | BIGINT FK → orders.id      | NOT NULL, **UNIQUE** (1-1)                                          |
| `carrier`           | VARCHAR(50)                | `aras`, `yurtici`, `mng`, `manual` …                                |
| `tracking_number`   | VARCHAR(80)                | NULLABLE, INDEX                                                     |
| `status`            | ENUM `shipment_status`     | `pending`, `in_transit`, `out_for_delivery`, `delivered`, `delayed`, `failed` |
| `expected_delivery` | DATE                       | NULLABLE                                                            |
| `delivered_at`      | TIMESTAMPTZ                | NULLABLE                                                            |
| `last_event`        | TEXT                       | NULLABLE — kargo firmasından son gelen event metni                  |
| `last_synced_at`    | TIMESTAMPTZ                | NULLABLE — kargo API son çekilme zamanı (gecikme tespiti için)      |
| `created_at` / `updated_at` | TIMESTAMPTZ        |                                                                     |

İndeksler: `(order_id) UNIQUE`, `(tracking_number)`, `(status)`.

> 3. madde örnek senaryosu için: ajanı saatte bir tetikleyen job, `status = 'in_transit'` ve `expected_delivery < CURRENT_DATE` olanları `delayed`'e çekip `notifications` üretir.

---

### 3.7 `tasks` — (5) İş Akışı / Görev

Depo / kargo görevlisi gibi ekip üyelerine atanan işler. `users` tablosuna bağlanır.

| Sütun           | Tip                       | Notlar                                                       |
| --------------- | ------------------------- | ------------------------------------------------------------ |
| `id`            | BIGSERIAL PK              |                                                              |
| `title`         | VARCHAR(200)              | NOT NULL                                                     |
| `description`   | TEXT                      | NULLABLE                                                     |
| `task_type`     | ENUM `task_type`          | `pack_order`, `ship_order`, `restock`, `general`             |
| `status`        | ENUM `task_status`        | `todo`, `in_progress`, `done`, `cancelled`                   |
| `priority`      | ENUM `task_priority`      | `low`, `normal`, `high`                                      |
| `assignee_id`   | BIGINT FK → users.id      | NULLABLE, INDEX                                              |
| `related_order_id` | BIGINT FK → orders.id  | NULLABLE, INDEX — sipariş bağlamı                            |
| `due_at`        | TIMESTAMPTZ               | NULLABLE                                                     |
| `created_at` / `updated_at` | TIMESTAMPTZ   |                                                              |

İndeksler: `(assignee_id, status)`, `(status, due_at)`.

> Örnek kullanım: 08:00 cron / agent → o günün siparişleri için `pack_order` ve `ship_order` task'larını otomatik oluşturur ve uygun kullanıcıya atar.

---

### 3.8 `notifications` — Ortak Bildirim Katmanı

Stok uyarısı, kargo gecikmesi, yeni sipariş özeti gibi tüm sistemi geçen bildirimler tek tabloda.

| Sütun           | Tip                          | Notlar                                                          |
| --------------- | ---------------------------- | --------------------------------------------------------------- |
| `id`            | BIGSERIAL PK                 |                                                                 |
| `user_id`       | BIGINT FK → users.id         | NULLABLE — null ise sistem geneli (broadcast)                   |
| `type`          | ENUM `notification_type`     | `low_stock`, `order_created`, `shipment_delayed`, `task_assigned`, `agent_action`, `info` |
| `title`         | VARCHAR(200)                 | NOT NULL                                                        |
| `message`       | TEXT                         | NOT NULL                                                        |
| `severity`      | ENUM `notification_severity` | `info`, `warning`, `critical`                                   |
| `is_read`       | BOOLEAN                      | NOT NULL, default FALSE                                         |
| `payload`       | JSONB                        | NULLABLE — `{order_id: 128, product_id: 7}` gibi bağlamsal data |
| `created_at`    | TIMESTAMPTZ                  |                                                                 |
| `read_at`       | TIMESTAMPTZ                  | NULLABLE                                                        |

İndeksler: `(user_id, is_read, created_at DESC)`, `(type, created_at DESC)`.

> Yönetici paneline besleme:
> ```sql
> SELECT * FROM notifications
> WHERE (user_id = :uid OR user_id IS NULL) AND is_read = FALSE
> ORDER BY created_at DESC LIMIT 50;
> ```

---

### 3.9 `agent_conversations` & `agent_messages` — (1) Müşteri İletişim Otomasyonu

AI ajanının müşteriyle yürüttüğü konuşmalar. Her konuşma bir kanal + müşteri ile bağdaşır. Mesajlar OpenAI / chat formatına yakın tutulur ki tool calls da serileştirilebilsin. WhatsApp'a özgü alanlar (medya, durum, idempotency `wamid`) doğrudan `agent_messages` üzerinde kanal-agnostik şekilde tutulur; ham webhook payload'ı `whatsapp_webhook_events` tablosuna düşer.

#### `agent_conversations`

| Sütun                | Tip                          | Notlar                                                  |
| -------------------- | ---------------------------- | ------------------------------------------------------- |
| `id`                 | BIGSERIAL PK                 |                                                         |
| `customer_id`        | BIGINT FK → customers.id     | NULLABLE — anonim/yeni gelen olabilir                   |
| `channel`            | ENUM `conversation_channel`  | `whatsapp`, `email`, `web`, `telegram`                  |
| `external_thread_id` | VARCHAR(128)                 | NULLABLE — kanal tarafındaki konuşma ID'si (WhatsApp için `wa_id`) |
| `wa_phone_number_id` | VARCHAR(64)                  | NULLABLE — işletmenin WhatsApp Business numara ID'si (multi-line destek) |
| `status`             | ENUM `conversation_status`   | `open`, `handled_by_ai`, `escalated`, `closed`          |
| `handled_by_user_id` | BIGINT FK → users.id         | NULLABLE — eskaleli durum                               |
| `last_message_at`    | TIMESTAMPTZ                  | NULLABLE                                                |
| `last_inbound_at`    | TIMESTAMPTZ                  | NULLABLE — 24 saat servis penceresi (WhatsApp policy) hesabı için |
| `unread_count`       | INTEGER                      | NOT NULL, default 0 — panelde rozet                     |
| `summary`            | TEXT                         | NULLABLE — ajanın ürettiği özet (CRM notları için)      |
| `created_at` / `updated_at` | TIMESTAMPTZ           |                                                         |

İndeksler: `(customer_id, last_message_at DESC)`, `(channel, external_thread_id)` UNIQUE, `(status, last_message_at DESC)`.

> WhatsApp 24-saat kuralı: `last_inbound_at` üzerinden son müşteri mesajından 24 saat geçtiyse sadece **onaylı template** ile yazılabilir → `whatsapp_templates` tablosu kullanılır.

#### `agent_messages`

Tüm kanalların tek mesaj tablosu. WhatsApp özelinde her mesaj bir `provider_message_id` (`wamid.xxx`) ile gelir; bunu UNIQUE tutarak webhook'un duplicate teslimlerine karşı **idempotency** sağlanır.

| Sütun                  | Tip                              | Notlar                                                                                  |
| ---------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                   | BIGSERIAL PK                     |                                                                                         |
| `conversation_id`      | BIGINT FK → agent_conversations.id | NOT NULL, INDEX, ON DELETE CASCADE                                                    |
| `direction`            | ENUM `message_direction`         | `inbound`, `outbound` — kanal-agnostik yön                                              |
| `role`                 | ENUM `message_role`              | `user`, `assistant`, `tool`, `system`                                                   |
| `message_type`         | ENUM `message_type`              | `text`, `image`, `audio`, `video`, `document`, `location`, `sticker`, `template`, `interactive`, `tool_call` |
| `content`              | TEXT                             | NULLABLE — text body veya caption                                                       |
| `provider`             | ENUM `message_provider`          | `whatsapp`, `email`, `web`, `telegram`, `internal`                                      |
| `provider_message_id`  | VARCHAR(128)                     | NULLABLE, UNIQUE — WhatsApp `wamid.xxx` (idempotency anahtarı)                          |
| `reply_to_message_id`  | BIGINT FK → agent_messages.id    | NULLABLE — WhatsApp `context.id` ile gelen yanıt zinciri                                |
| `wa_template_id`       | BIGINT FK → whatsapp_templates.id | NULLABLE — outbound template mesajları için                                            |
| `wa_interactive_payload` | JSONB                          | NULLABLE — buton/list seçim sonucu (`button_reply`, `list_reply`)                       |
| `status`               | ENUM `message_status`            | `queued`, `sent`, `delivered`, `read`, `failed` — WhatsApp status webhook'u günceller   |
| `error_code`           | VARCHAR(40)                      | NULLABLE — başarısızlık halinde (örn. `131047` 24h window expired)                      |
| `error_message`        | TEXT                             | NULLABLE                                                                                |
| `tool_name`            | VARCHAR(80)                      | NULLABLE — `get_order_status`, `check_stock`, vb.                                       |
| `tool_payload`         | JSONB                            | NULLABLE — tool args / result                                                           |
| `tokens_used`          | INTEGER                          | NULLABLE                                                                                |
| `sent_at`              | TIMESTAMPTZ                      | NULLABLE                                                                                |
| `delivered_at`         | TIMESTAMPTZ                      | NULLABLE                                                                                |
| `read_at`              | TIMESTAMPTZ                      | NULLABLE                                                                                |
| `created_at`           | TIMESTAMPTZ                      |                                                                                         |

İndeksler: `(conversation_id, created_at)`, `(provider_message_id) UNIQUE WHERE provider_message_id IS NOT NULL`, `(status, created_at)`.

> Inbound text mesajı şu şekilde düşer:
> `direction='inbound'`, `role='user'`, `message_type='text'`, `provider='whatsapp'`, `provider_message_id='wamid.xxx'`, `status='delivered'`.
>
> Ajanın yanıtı:
> `direction='outbound'`, `role='assistant'`, `message_type='text'`, `provider='whatsapp'`, `status='queued'` → API çağrısı sonrası `sent`, sonra webhook ile `delivered` / `read`.

---

### 3.10 `whatsapp_media` — Medya Ekleri

WhatsApp'tan gelen ses/görsel/PDF mesajlar Cloud API'den `media_id` ile çekilir, mevcut `storage_service` ile S3-uyumlu bucket'a yazılır. Mesajla 1-N (genelde 1-1) ilişki.

| Sütun              | Tip                          | Notlar                                                                |
| ------------------ | ---------------------------- | --------------------------------------------------------------------- |
| `id`               | BIGSERIAL PK                 |                                                                       |
| `message_id`       | BIGINT FK → agent_messages.id | NOT NULL, INDEX, ON DELETE CASCADE                                   |
| `wa_media_id`      | VARCHAR(128)                 | NULLABLE — WhatsApp Cloud API media ID                                |
| `mime_type`        | VARCHAR(80)                  | NOT NULL — `image/jpeg`, `audio/ogg; codecs=opus`, `application/pdf`  |
| `file_name`        | VARCHAR(255)                 | NULLABLE                                                              |
| `storage_key`      | VARCHAR(512)                 | NULLABLE — S3/MinIO key (download tamamlandıktan sonra dolar)         |
| `size_bytes`       | INTEGER                      | NULLABLE                                                              |
| `sha256`           | VARCHAR(64)                  | NULLABLE — kanal tarafından sağlanan hash (varsa)                     |
| `caption`          | TEXT                         | NULLABLE                                                              |
| `download_status`  | ENUM `media_download_status` | `pending`, `downloaded`, `failed`                                     |
| `created_at`       | TIMESTAMPTZ                  |                                                                       |

İndeksler: `(message_id)`, `(wa_media_id)`.

> Akış: webhook → `agent_messages` insert + `whatsapp_media` row'u `pending` olarak yaz → arkaplan task `wa_media_id`'yi indirir → `storage_key` doldurur, `download_status='downloaded'` yapar. Bu sayede webhook'a 200 hızlı dönülür (Meta 5sn timeout).

---

### 3.11 `whatsapp_templates` — Onaylı Şablon Mesajlar

24 saat servis penceresi dışında WhatsApp **sadece onaylı template** ile mesaj göndermeye izin verir. Meta Business Manager'da tanımlı template'lerin yerel kopyası.

| Sütun             | Tip                          | Notlar                                                                |
| ----------------- | ---------------------------- | --------------------------------------------------------------------- |
| `id`              | BIGSERIAL PK                 |                                                                       |
| `name`            | VARCHAR(120)                 | NOT NULL — Meta'daki template adı (ör. `order_shipped`)               |
| `language`        | VARCHAR(10)                  | NOT NULL — `tr`, `en_US` …                                            |
| `category`        | ENUM `template_category`     | `marketing`, `utility`, `authentication`                              |
| `status`          | ENUM `template_status`       | `pending`, `approved`, `rejected`, `paused`                           |
| `body`            | TEXT                         | NOT NULL — `{{1}}, {{2}}` placeholder'lı gövde                        |
| `variables_schema`| JSONB                        | NULLABLE — `{"1":"order_number","2":"tracking_url"}`                  |
| `created_at` / `updated_at` | TIMESTAMPTZ        |                                                                       |

İndeksler: `(name, language) UNIQUE`.

> Örnek kullanım: kargo `delayed`'e düştüğünde `notify_shipment_delay(order_id)` tool'u → `whatsapp_templates` `name='shipment_delayed'` ile outbound mesaj atar, `agent_messages.wa_template_id`'ye linkler.

---

### 3.12 `whatsapp_webhook_events` — Ham Webhook Logu

Meta'dan gelen her webhook payload'ı (mesaj + status callback) önce buraya ham JSONB olarak yazılır, sonra işlenir. Debug, replay ve audit için kritik.

| Sütun              | Tip                            | Notlar                                                              |
| ------------------ | ------------------------------ | ------------------------------------------------------------------- |
| `id`               | BIGSERIAL PK                   |                                                                     |
| `event_type`       | ENUM `wa_event_type`           | `message`, `status`, `error`, `unknown`                             |
| `wa_phone_number_id` | VARCHAR(64)                  | NULLABLE                                                            |
| `wa_message_id`    | VARCHAR(128)                   | NULLABLE, INDEX — `wamid.xxx` (status event'i için referans)        |
| `payload`          | JSONB                          | NOT NULL — Meta'nın gönderdiği orijinal body                        |
| `signature`        | VARCHAR(256)                   | NULLABLE — `X-Hub-Signature-256` doğrulama için saklanır            |
| `processed`        | BOOLEAN                        | NOT NULL, default FALSE                                             |
| `processed_at`     | TIMESTAMPTZ                    | NULLABLE                                                            |
| `error`            | TEXT                           | NULLABLE — işleme hatası mesajı                                     |
| `received_at`      | TIMESTAMPTZ                    | NOT NULL, default `now()`                                           |

İndeksler: `(wa_message_id)`, `(processed, received_at)`, `(event_type, received_at DESC)`.

> Webhook handler şu sırayı izler: ham payload'ı INSERT → 200 OK döndür → arkaplanda parse edip `agent_messages` / `agent_conversations` / `customers` tablolarını günceller, `processed=TRUE` yapar. Hata durumunda `error` doldurulur, retry edilebilir.

---

### 3.13 (Opsiyonel) `daily_sales_stats` — (6) Analitik

Hackathon süresi yetmezse atlanabilir. Geçmiş satış / talep tahmini için günlük rollup.

| Sütun           | Tip                         | Notlar                                          |
| --------------- | --------------------------- | ----------------------------------------------- |
| `id`            | BIGSERIAL PK                |                                                 |
| `date`          | DATE                        | NOT NULL                                        |
| `product_id`    | BIGINT FK → products.id     | NOT NULL                                        |
| `units_sold`    | NUMERIC(12,3)               | NOT NULL                                        |
| `revenue`       | NUMERIC(12,2)               | NOT NULL                                        |
| `orders_count`  | INTEGER                     | NOT NULL                                        |

UNIQUE `(date, product_id)`. Günlük cron veya `MATERIALIZED VIEW` olarak da düşünülebilir.

---

## 4. Enum Listesi

```text
product_unit            : piece | kg | lt | pack
stock_movement_type     : in | out | adjustment
order_status            : pending | confirmed | preparing | shipped | delivered | cancelled
shipment_status         : pending | in_transit | out_for_delivery | delivered | delayed | failed
task_type               : pack_order | ship_order | restock | general
task_status             : todo | in_progress | done | cancelled
task_priority           : low | normal | high
notification_type       : low_stock | order_created | shipment_delayed | task_assigned | agent_action | whatsapp_inbound | info
notification_severity   : info | warning | critical
conversation_channel    : whatsapp | email | web | telegram
conversation_status     : open | handled_by_ai | escalated | closed
message_role            : user | assistant | tool | system
message_direction       : inbound | outbound
message_type            : text | image | audio | video | document | location | sticker | template | interactive | tool_call
message_provider        : whatsapp | email | web | telegram | internal
message_status          : queued | sent | delivered | read | failed
media_download_status   : pending | downloaded | failed
template_category       : marketing | utility | authentication
template_status         : pending | approved | rejected | paused
wa_event_type           : message | status | error | unknown
```

---

## 5. Görev → Tablo Eşlemesi

| Görev (hackathon)                         | Birincil tablolar                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Müşteri iletişimi otomasyonu (WhatsApp) | `agent_conversations`, `agent_messages`, `whatsapp_media`, `whatsapp_templates`, `whatsapp_webhook_events`, `customers` |
| 2. Ürün ve sipariş takibi                 | `products`, `orders`, `order_items`, `customers`                                   |
| 3. Kargo süreçleri                        | `shipments`, `orders`, `notifications`, `whatsapp_templates` (delay bildirimi)     |
| 4. Stok / envanter                        | `products`, `stock_movements`, `notifications`                                     |
| 5. İş akışı / görev                       | `tasks`, `users`, `orders`                                                         |
| 6. Analitik (opsiyonel)                   | `daily_sales_stats` veya `orders` + `order_items` üzerinden SQL                    |
| Bildirim                                  | `notifications` (tüm modüller besler)                                              |

---

## 6. AI Ajanı için Tool → SQL Önerisi

| Tool adı              | Yaptığı iş                                       | Tipik sorgu                                                                                       |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `get_order_status`    | Sipariş + kargo durumu                           | `SELECT o.status, s.status, s.tracking_number, s.expected_delivery FROM orders o LEFT JOIN shipments s ON s.order_id = o.id WHERE o.order_number = :no` |
| `check_stock`         | Ürün stoğu                                       | `SELECT name, stock, unit, low_stock_threshold FROM products WHERE name ILIKE :q OR sku = :q`     |
| `list_today_orders`   | Bugünün siparişleri özeti                        | `SELECT id, order_number, status FROM orders WHERE created_at::date = CURRENT_DATE`               |
| `create_task`         | Yeni iş atama                                    | `INSERT INTO tasks (title, task_type, assignee_id, related_order_id) VALUES (...)`                |
| `notify_low_stock`    | Eşik altı ürünler için bildirim üret             | `SELECT id, name FROM products WHERE stock < low_stock_threshold AND is_active`                   |
| `detect_delayed_shipments` | Geciken kargoları işaretle                  | `UPDATE shipments SET status = 'delayed' WHERE status = 'in_transit' AND expected_delivery < CURRENT_DATE` |
| `record_agent_message`| Konuşma loglama                                  | `INSERT INTO agent_messages ...`                                                                  |
| `send_whatsapp_text`  | 24h pencere içinde serbest metin gönder         | `INSERT INTO agent_messages (..., direction='outbound', provider='whatsapp', message_type='text', status='queued')` → API → status=`sent` |
| `send_whatsapp_template` | Pencere dışı / proaktif template gönder       | `whatsapp_templates` lookup + `agent_messages` insert (`message_type='template'`, `wa_template_id=:id`) |
| `download_whatsapp_media` | Cloud API'den medya indir, S3'e yaz         | `whatsapp_media` `wa_media_id` ile alınır → `storage_key` doldurulur, `download_status='downloaded'` |

---

## 7. WhatsApp Akış Detayları

### 7.1 Inbound mesaj akışı (müşteri → sistem)

1. Meta `POST /webhook/whatsapp` gönderir.
2. Handler signature (`X-Hub-Signature-256`) doğrular, ham payload'ı `whatsapp_webhook_events` tablosuna `processed=false` olarak yazar ve **200 OK** döner (Meta 5sn timeout'u).
3. Arkaplan worker payload'ı parse eder:
   - `messages[].from` → `customers` upsert (`whatsapp_id` UNIQUE).
   - Conversation lookup/insert (`channel='whatsapp'`, `external_thread_id=wa_id`).
   - `agent_messages` insert: `direction='inbound'`, `role='user'`, `provider_message_id=wamid.xxx` (UNIQUE → idempotent).
   - Medya varsa `whatsapp_media` row'u `pending` ile yazılır, ayrı job indirir.
   - Konuşma `last_inbound_at`, `last_message_at`, `unread_count++` güncellenir.
   - `whatsapp_webhook_events.processed=true`.
4. AI ajanı tetiklenir → tool çağrıları → outbound mesaj.

### 7.2 Outbound mesaj akışı (sistem → müşteri)

1. Ajan `send_whatsapp_text` veya `send_whatsapp_template` tool'u çağırır.
2. `agent_messages` row'u `status='queued'` ile insert edilir.
3. Cloud API çağrısı yapılır; dönen `messages[0].id` → `provider_message_id` doldurulur, `status='sent'`, `sent_at=now()`.
4. Status webhook'u (`event_type='status'`) geldiğinde aynı `provider_message_id` ile mesaj bulunur, `status` ve `delivered_at` / `read_at` alanları güncellenir.
5. Hata gelirse `status='failed'`, `error_code` (örn. `131047`) ve `error_message` doldurulur.

### 7.3 24 saat servis penceresi kontrolü

Outbound göndermeden önce:

```sql
SELECT (now() - last_inbound_at) < interval '24 hours' AS in_window
FROM agent_conversations WHERE id = :cid;
```

`in_window=false` ise serbest metin **engellenir**, sadece `whatsapp_templates.status='approved'` olan template gönderilebilir.

### 7.4 Idempotency

- **Inbound:** `agent_messages.provider_message_id UNIQUE` → aynı `wamid` ikinci kez gelirse `ON CONFLICT DO NOTHING` ile yutulur.
- **Outbound:** `whatsapp_webhook_events.wa_message_id` üzerinden status update'i tek bir mesaja eşlenir.

### 7.5 Webhook doğrulama (Meta verify challenge)

`GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` → token `.env`'deki `WHATSAPP_VERIFY_TOKEN` ile eşleşirse `hub.challenge` plain-text döner. Bu DB'de tutulmaz; sadece config (`backend/app/core/config.py`) konusu.

---

## 8. Migration Stratejisi (Alembic)

Mevcut `0001_initial` `users` ve `token_blocklist` içeriyor. Bu şema için **üç revizyon** önerilir:

1. `0002_core_domain` — `customers` (WhatsApp alanları dahil), `products`, `stock_movements`, `orders`, `order_items`, `shipments`, `tasks`, `notifications` (+ enum'lar).
2. `0003_agent_layer` — `agent_conversations`, `agent_messages`.
3. `0004_whatsapp` — `whatsapp_media`, `whatsapp_templates`, `whatsapp_webhook_events`.

Komut:

```bash
alembic revision -m "core domain"
alembic revision -m "agent layer"
alembic revision -m "whatsapp"
alembic upgrade head
```

Modeller `backend/app/models/` altında her tablo için ayrı dosya olarak (`product.py`, `order.py`, `shipment.py`, `task.py`, `notification.py`, `agent.py`, `whatsapp.py`) eklenip `models/__init__.py` üzerinden export edilmelidir; alembic env.py bunları otomatik toplar.

---

## 9. Hackathon İçin Önerilen Seed Data

Demo akıcılığı için minimum:

- 1 admin user (zaten init_db ile gelebilir).
- 5–10 `customers`, en az 3'ü `whatsapp_id` dolu, `whatsapp_opt_in=true`.
- 15–20 `products`, en az 3 tanesi `low_stock_threshold` üstünde, 1 tanesi altında (uyarı tetiklensin).
- 5–8 `orders` farklı `status`'larda; en az 1 `delayed` shipment.
- 2 `tasks` (1 `todo`, 1 `done`).
- 3 `notifications` (1 `critical` low_stock, 1 `warning` shipment_delayed, 1 `info`).
- 2 onaylı `whatsapp_templates`: `order_shipped` (utility), `shipment_delayed` (utility).
- 1 `agent_conversation` (channel=`whatsapp`) + 5 `agent_messages`:
  1. inbound text — "128 numaralı siparişim ne zaman gelir?"
  2. assistant tool_call — `get_order_status`
  3. tool result — JSON (sipariş + kargo)
  4. outbound text — "Siparişiniz Aras Kargo'da, yarın teslim."
  5. status update — `delivered` → `read` (test webhook ile).
- 1 `whatsapp_media` örneği (ürün fotoğrafı içeren inbound mesaj) `download_status='downloaded'`.

---

## 10. Kapsam Dışı (Bilinçli Olarak Tutulmayanlar)

Hackathon süresinde sade kalmak için **eklenmeyenler**:

- Çoklu işletme / tenant izolasyonu (`business_id`).
- Adres tablosu (tek `customers.address` alanı yeterli).
- Ödeme / fatura tabloları (`payments`, `invoices`).
- Kullanıcı izinleri / fine-grained RBAC (mevcut `user_role` yeterli).
- Ürün varyantları (renk/beden) — tek SKU varsayımı.
- Kargo event geçmişi tablosu — `shipments.last_event` + `last_synced_at` yeterli.
- WhatsApp dışındaki kanallar için ayrı altyapı (email/telegram **şemada var** ama implementasyon WhatsApp önceliklidir).
- WhatsApp reaction / typing indicator / read receipt'in detay logu — `agent_messages.status` yeterli.
- Template variable'larının ayrı tablosu — `whatsapp_templates.variables_schema` JSONB yeterli.

Gerekirse hackathon sonrası kolayca eklenebilecek şekilde tasarlandı.

---

## 11. WhatsApp Cloud API için Gerekli Env Değişkenleri

`backend/.env` dosyasına eklenecekler (DB şemasını etkilemez ama bütünlük için):

```env
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...           # webhook GET challenge
WHATSAPP_APP_SECRET=...              # X-Hub-Signature-256 doğrulaması
WHATSAPP_API_VERSION=v21.0
WHATSAPP_GRAPH_BASE_URL=https://graph.facebook.com
```
