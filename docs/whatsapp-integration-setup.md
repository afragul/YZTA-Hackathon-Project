# WhatsApp Business API Bağlantısı — KOBİ Onboarding Rehberi

Bu doküman, **tek bir KOBİ'nin tek bir WhatsApp Business telefon numarası** üzerinden sistemimize bağlanmasını anlatır. Hedef: Yönetici panelinde **Entegrasyonlar → WhatsApp → Bağla** butonuna basınca açılacak modal'ın hangi alanları içermesi gerektiği, kullanıcının bu alanları nereden alacağı ve veri tabanında nasıl saklanacağı.

> Bu doküman `docs/hackathon-db-schema.md` ile birlikte okunmalıdır. Şema tarafında **yeni bir tablo** önerilir: `whatsapp_accounts` (bkz. §6).

---

## 1. Neden Cloud API + Manuel Onboarding?

WhatsApp Business API'ye bağlanmanın iki yolu var:

| Yol | Açıklama | Hackathon için |
| --- | -------- | -------------- |
| **A. Embedded Signup (Tech Provider)** | Müşteri `Continue with Facebook` ile bizim Meta App'imizden geçer; biz arkadan token alırız. En temiz UX, ama Meta App Review + Tech Provider partner statüsü gerektirir. | Süre yetmez, kapsam dışı. |
| **B. Manuel Cloud API** | KOBİ kendi Meta Business hesabını açar, telefon numarasını ekler, Permanent Access Token üretir, panelimize girer. | **Bu rehberin kapsamı.** Hackathon demosu için ideal. |

> Üretim için ileride Embedded Signup'a geçilebilir; DB modelimiz iki yolu da destekliyor (`onboarding_method` alanı).

---

## 2. KOBİ'nin Önceden Yapması Gerekenler

Modal'ı açmadan önce kullanıcı bu adımları tamamlamış olmalıdır. Modal'ın üst kısmında **"Önce şunları hazırlayın"** akordiyonu ile gösterilecek.

1. **Meta Business hesabı.** [business.facebook.com](https://business.facebook.com) → hesabı yoksa açar. Adımlar arasında WhatsApp Business Account (WABA) ve Business verification (gerekiyorsa) yer alır.
2. **WhatsApp Business App.** [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → Business türü → WhatsApp ürününü ekle.
3. **Telefon numarası kaydı.** Mevcut WhatsApp (kişisel veya Business app) hesabıyla zaten kullanılan numara önce o hesaplardan **silinmelidir**. Sonra Meta Business → WhatsApp → Phone Numbers → Add → SMS / sesli arama ile doğrulama.
4. **Permanent Access Token.** Test token'ı 24 saatte expire olur. Kalıcı token için: Meta Business → System Users → Add → Admin → Assign Asset (WABA) → Generate Token (`whatsapp_business_messaging`, `whatsapp_business_management` izinleri).
5. **App Secret.** App Dashboard → Settings → Basic → App Secret (Show).
6. **Webhook Verify Token.** KOBİ'nin kendi belirlediği rastgele bir string. Bizde de aynısı kayıtlı olacak. Modal içinden **otomatik üretilebilir**.

---

## 3. Modal Akışı (UX)

Panel → **Entegrasyonlar** sekmesi → WhatsApp kartı → **Bağla** butonu.

### 3.1 Adımlar

Modal **3 adımlı bir wizard** olarak tasarlanır:

```
[1] Bilgilendirme        →   [2] Kimlik Bilgileri        →   [3] Webhook & Doğrulama
   (önkoşullar listesi)       (Phone Number ID, Token …)      (URL kopyala, test et)
```

#### Adım 1 — Bilgilendirme

- §2'deki ön koşullar checklist olarak. Her madde altında kısa açıklama + Meta'ya doğrudan link.
- Kullanıcı **"Hepsini yaptım, devam et"** kutusunu işaretler → İleri.

#### Adım 2 — Kimlik Bilgileri (asıl form)

Aşağıdaki §4 alanlarını içerir.

#### Adım 3 — Webhook & Doğrulama

- **Webhook Callback URL** (read-only, kopyala butonu): `https://{API_BASE}/api/v1/integrations/whatsapp/webhook`
- **Verify Token** (read-only, kopyala butonu): adım 2'de girilen / üretilen değer.
- **Subscribe edilecek alanlar** listesi: `messages`, `message_template_status_update`. Kullanıcı Meta Dashboard'da bunları işaretler.
- **"Test Mesajı Gönder"** butonu: kullanıcı kendi numarasına test mesajı atar, sistem `messages` webhook'unu aldıysa `is_verified=true` işaretler ve modal başarı durumuyla kapanır.

---

## 4. Modal Form Alanları

Bu alanlar **Adım 2**'de KOBİ'den istenir. Tablo, frontend formu ve backend `WhatsAppAccountCreate` schema'sı için tek kaynak.

| Alan (UI label)           | Form key                   | Tip       | Zorunlu | Validation                                  | Kullanıcı nereden alır?                                                                 |
| ------------------------- | -------------------------- | --------- | ------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Görünen Ad                | `display_name`             | text      | ✓       | 2–60 char                                   | KOBİ'nin tercihi (panelde "WhatsApp — Mağaza Adı" gibi). Sadece UI etiketi.             |
| WhatsApp İşletme Numarası | `phone_e164`               | text      | ✓       | E.164 (`+905551234567`)                     | KOBİ'nin Meta'da doğruladığı numara.                                                    |
| Phone Number ID           | `phone_number_id`          | text      | ✓       | 10–20 rakam                                 | Meta App Dashboard → WhatsApp → API Setup → "From" numarası altındaki ID.              |
| WhatsApp Business Account ID (WABA ID) | `business_account_id` | text | ✓ | 10–20 rakam                                | Meta Business Settings → WhatsApp Accounts → seçilen WABA → ID.                        |
| Permanent Access Token    | `access_token`             | secret    | ✓       | Boş olmayan, en az 100 char                 | Meta Business → System Users → Generate Token (kalıcı, expire yok).                     |
| App ID                    | `app_id`                   | text      | ✓       | 15–18 rakam                                 | Meta App Dashboard → Settings → Basic → App ID.                                         |
| App Secret                | `app_secret`               | secret    | ✓       | 32 char hex                                 | Meta App Dashboard → Settings → Basic → App Secret (Show).                              |
| Webhook Verify Token      | `verify_token`             | secret    | ✓       | 16–64 char, `[A-Za-z0-9_-]`                 | KOBİ kendi belirler; modal'da **"Otomatik Üret"** butonu olur (`crypto.randomUUID()`). |
| Graph API Sürümü          | `api_version`              | select    | —       | `v21.0` (default), `v20.0`, `v19.0`         | Default `v21.0` — kullanıcı genelde dokunmaz.                                           |
| Varsayılan Dil            | `default_language`         | select    | —       | `tr` (default), `en_US` …                   | Template fallback dili.                                                                 |

> **Yardım metni paterni:** Her alanın yanında küçük (i) ikonu olur. Tıklanınca tooltip içinde "Bu değeri Meta App Dashboard'da `Settings → Basic` ekranında bulabilirsiniz" gibi tek cümlelik yönlendirme + ekran görüntüsü thumbnail'i.

### 4.1 Frontend State Şeması (TypeScript)

```ts
interface WhatsAppAccountForm {
  display_name: string;
  phone_e164: string;
  phone_number_id: string;
  business_account_id: string;
  access_token: string;          // password input, asla logla
  app_id: string;
  app_secret: string;            // password input
  verify_token: string;          // password input + üret butonu
  api_version: 'v21.0' | 'v20.0' | 'v19.0';
  default_language: 'tr' | 'en_US';
}
```

### 4.2 Güvenlik Kuralları (UI tarafı)

- `access_token`, `app_secret`, `verify_token` → `<input type="password">` + göz simgesiyle aç/kapa.
- Form submit edilene kadar değerler **state'te plaintext**, response'tan asla geri okunmaz (sadece `last4` döner).
- Clipboard API ile "Kopyala" butonları toast ile geri bildirir; hassas alanların paste edildikten sonra otomatik maskelenmesi.
- Tarayıcı autofill kapalı (`autocomplete="new-password"`).

---

## 5. Backend Endpoint'leri

Yeni modül: `backend/app/api/v1/endpoints/integrations_whatsapp.py`.

| Method | Path                                                  | Amaç                                                                          |
| ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST   | `/api/v1/integrations/whatsapp`                       | Yeni hesap kaydı. Body §4 alanları. Token şifrelenip yazılır.                 |
| GET    | `/api/v1/integrations/whatsapp`                       | Mevcut bağlantının özetini döner (token'lar `last4` olarak maskelenir).       |
| PATCH  | `/api/v1/integrations/whatsapp/{id}`                  | Token rotasyonu, display_name güncellemesi.                                   |
| DELETE | `/api/v1/integrations/whatsapp/{id}`                  | Bağlantıyı kaldırır (`status='disconnected'`); webhook hâlâ alınsa da reddedilir. |
| POST   | `/api/v1/integrations/whatsapp/{id}/test`             | Sağlanan token ile Graph API'ye `GET /{phone_number_id}` çağrısı yapar; 200 ise `is_verified_credentials=true`. |
| POST   | `/api/v1/integrations/whatsapp/{id}/send-test`        | KOBİ'nin kendi numarasına `hello_world` template'i atar, başarıdaysa `is_verified_messaging=true`. |
| GET    | `/api/v1/integrations/whatsapp/webhook`               | Meta verify challenge (`hub.mode`, `hub.verify_token`, `hub.challenge`).      |
| POST   | `/api/v1/integrations/whatsapp/webhook`               | Mesaj/durum webhook'u; `X-Hub-Signature-256` doğrulaması yapılır.             |

### 5.1 Test akışı (önerilen)

1. Kullanıcı Adım 2'de form'u submit eder → backend kaydı yapar, sync olarak `/{phone_number_id}` çağırır.
2. Çağrı başarısız olursa form'a alan bazlı hata döner ("Phone Number ID veya Token hatalı").
3. Başarılıysa Adım 3'e geçilir; webhook URL ve verify token gösterilir.
4. Kullanıcı Meta'da webhook'u kaydeder. Meta sistemimize `GET ?hub.challenge=...` atar → biz `verify_token` eşleşirse `hub.challenge` döneriz.
5. Modal'daki **"Test Mesajı Gönder"** → bizden Meta'ya `hello_world` template'i gider; kullanıcı kendi telefonunda görür → cevap olarak ne yazarsa webhook'a düşer → 60 sn polling ile modal "Doğrulandı" kutusunu yeşile çevirir.

---

## 6. Veri Tabanı: `whatsapp_accounts` Tablosu (Şema Eklemesi)

`docs/hackathon-db-schema.md` §3'e şu tablo eklenir. Hackathon için **tek satır** olur, ama yapı multi-account'a hazırdır.

| Sütun                          | Tip                              | Notlar                                                                              |
| ------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                           | BIGSERIAL PK                     |                                                                                     |
| `display_name`                 | VARCHAR(80)                      | NOT NULL — UI etiketi                                                               |
| `phone_e164`                   | VARCHAR(20)                      | NOT NULL — `+905551234567`                                                          |
| `phone_number_id`              | VARCHAR(64)                      | NOT NULL, **UNIQUE** — Meta'nın atadığı sayısal ID                                  |
| `business_account_id`          | VARCHAR(64)                      | NOT NULL — WABA ID                                                                  |
| `app_id`                       | VARCHAR(32)                      | NOT NULL                                                                            |
| `api_version`                  | VARCHAR(10)                      | NOT NULL, default `'v21.0'`                                                         |
| `default_language`             | VARCHAR(10)                      | NOT NULL, default `'tr'`                                                            |
| `access_token_ciphertext`      | TEXT                             | NOT NULL — Fernet (AES-128-CBC + HMAC) ile şifrelenmiş; key `.env`'de               |
| `access_token_last4`           | VARCHAR(4)                       | NOT NULL — UI'da "•••• ABCD" göstermek için                                         |
| `app_secret_ciphertext`        | TEXT                             | NOT NULL                                                                            |
| `app_secret_last4`             | VARCHAR(4)                       | NOT NULL                                                                            |
| `verify_token_ciphertext`      | TEXT                             | NOT NULL                                                                            |
| `onboarding_method`            | ENUM `wa_onboarding_method`      | `manual` (şimdilik), `embedded_signup` (gelecek)                                    |
| `status`                       | ENUM `wa_account_status`         | `pending`, `connected`, `disconnected`, `error`                                     |
| `is_verified_credentials`      | BOOLEAN                          | NOT NULL, default FALSE — `/{phone_number_id}` çağrısı 200 ise TRUE                 |
| `is_verified_messaging`        | BOOLEAN                          | NOT NULL, default FALSE — gerçek webhook bir mesaj geldikten sonra TRUE             |
| `webhook_subscribed`           | BOOLEAN                          | NOT NULL, default FALSE                                                             |
| `last_error`                   | TEXT                             | NULLABLE                                                                            |
| `last_synced_at`               | TIMESTAMPTZ                      | NULLABLE                                                                            |
| `connected_by_user_id`         | BIGINT FK → users.id             | NOT NULL — bağlantıyı kuran admin                                                   |
| `created_at` / `updated_at`    | TIMESTAMPTZ                      |                                                                                     |

İndeksler: `(phone_number_id) UNIQUE`, `(status)`.

### 6.1 Yeni Enum'lar

```text
wa_onboarding_method   : manual | embedded_signup
wa_account_status      : pending | connected | disconnected | error
```

### 6.2 Diğer tablolarla ilişki

- `agent_conversations.wa_phone_number_id` → bu tablonun `phone_number_id`'sine işaret eder (FK olmasa da mantıken bağlı). Multi-account'ta FK eklenir.
- `whatsapp_webhook_events.wa_phone_number_id` → aynı şekilde.
- `whatsapp_templates` → ileride `whatsapp_account_id` FK ile bağlanabilir; hackathon scope'unda global tutulabilir.

### 6.3 Şifreleme

- `.env`'e `ENCRYPTION_KEY` eklenir (32-byte url-safe base64, Fernet için).
- `backend/app/core/security.py` içine `encrypt_secret(plain) -> str` ve `decrypt_secret(cipher) -> str` helper'ları.
- DB'ye **plaintext** token asla yazılmaz. Loglara da basılmaz; logger filter'ı `access_token`, `app_secret`, `verify_token` key'lerini `***` ile maskeler.
- Token rotasyonu: PATCH endpoint yeni şifrelenmiş değeri yazar; eski cipher silinir.

---

## 7. Migration Stratejisi

`docs/hackathon-db-schema.md` §8'deki migration listesine eklenir:

```
0002_core_domain
0003_agent_layer
0004_whatsapp           (whatsapp_media, whatsapp_templates, whatsapp_webhook_events)
0005_whatsapp_account   (whatsapp_accounts + 2 enum)   ← BU DOKÜMAN
```

```bash
alembic revision -m "whatsapp account"
alembic upgrade head
```

---

## 8. Modal İçin Hata Yönetimi

| Senaryo                                                | Kullanıcıya gösterilen mesaj                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `phone_number_id` bulunamadı (Meta 404)                | "Phone Number ID hatalı veya bu token bu numaraya erişemiyor."                                     |
| Token expired / invalid (Meta 401)                     | "Access Token geçersiz. Lütfen Meta Business → System Users üzerinden kalıcı token üretin."        |
| Token izinleri eksik (`whatsapp_business_messaging` yok) | "Token'a `whatsapp_business_messaging` izni atanmamış."                                          |
| Webhook verify timeout (Meta bize ulaşamıyor)          | "Meta sunucularımıza ulaşamadı. URL'nin HTTPS ve internete açık olduğundan emin olun."             |
| Signature mismatch (`X-Hub-Signature-256`)             | (sessizce 403 ve `whatsapp_webhook_events.error` doldur, panelde toast)                            |
| Aynı `phone_number_id` zaten kayıtlı                   | "Bu WhatsApp numarası zaten bağlı. Önce mevcut bağlantıyı kaldırın."                                |

---

## 9. Modal'ın Hazır Veri Önişlemeleri

Form submit anında frontend şu normalizasyonları yapar:

- `phone_e164` → boşluklar silinir, başında `+` yoksa eklenir, sadece rakam + `+` kalır.
- `phone_number_id`, `business_account_id`, `app_id` → tüm whitespace silinir.
- `access_token` → `Bearer ` prefix'i yapıştırıldıysa otomatik temizlenir.
- `verify_token` boşsa **otomatik `crypto.randomUUID()`** ile doldurulur ve kullanıcıya kopyalat.

---

## 10. Sonradan Eklenecekler (Roadmap)

Hackathon scope'unda **dokunulmayacak**, ama mimari hazırlığı yapıldı:

- **Embedded Signup**: `onboarding_method='embedded_signup'`, FB JS SDK üzerinden token alınır; modal yerine "Continue with Facebook" tek butona düşer.
- **Multi-account**: Birden fazla WhatsApp numarası bağlama; `agent_conversations.whatsapp_account_id` FK olur.
- **Token health check job**: Saatlik cron Graph API health çağrısı, expire/invalid olunca admin'e bildirim.
- **Template senkronizasyonu**: Meta'dan `GET /{waba_id}/message_templates` ile yerel `whatsapp_templates` tablosu sync edilir.
- **Two-Factor PIN**: Meta tarafından bazı işlemler için istenen 6 haneli PIN. Modal'a opsiyonel alan eklenir.

---

## 11. Hızlı Test Senaryosu (Demo İçin)

1. Admin panele giriş yapar → Entegrasyonlar → WhatsApp → **Bağla**.
2. Modal Adım 1 → checkbox işaretler → İleri.
3. Adım 2 → 9 alanı doldurur (Verify Token "Üret" ile otomatik).
4. **Doğrula & Kaydet** → backend Graph API'ye health çağrısı yapar → ✓ yeşil.
5. Adım 3 → Webhook URL & Verify Token gösterilir → kullanıcı Meta'da yapıştırıp Subscribe eder.
6. **Test Mesajı Gönder** → kullanıcı telefonunda `hello_world` template gelir → kullanıcı "merhaba" yazar → modal "Doğrulandı" yeşil rozetiyle kapanır.
7. `whatsapp_accounts.status='connected'`, `is_verified_messaging=true`. Sonraki tüm gelen mesajlar `agent_conversations` + `agent_messages` tablolarına işlenir.
