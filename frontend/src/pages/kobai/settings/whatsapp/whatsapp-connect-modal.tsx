import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import {
  whatsappApi,
  type WhatsAppAccount,
  type WhatsAppAccountCreate,
} from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAccount?: WhatsAppAccount | null;
  onConnected: (account: WhatsAppAccount) => void;
}

type Step = 1 | 2 | 3;

const EMPTY: WhatsAppAccountCreate = {
  display_name: '',
  phone_e164: '',
  phone_number_id: '',
  business_account_id: '',
  app_id: '',
  access_token: '',
  app_secret: '',
  verify_token: '',
  api_version: 'v21.0',
  default_language: 'tr',
};

const META_LINKS = {
  business: 'https://business.facebook.com',
  developers: 'https://developers.facebook.com/apps',
  whatsappManager:
    'https://business.facebook.com/wa/manage/phone-numbers/',
};

function generateVerifyToken(): string {
  // 32 url-safe chars
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function normalizePhone(value: string): string {
  let v = value.replace(/[^\d+]/g, '');
  if (v && !v.startsWith('+')) v = '+' + v;
  return v;
}

export function WhatsAppConnectModal({
  open,
  onOpenChange,
  initialAccount,
  onConnected,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<WhatsAppAccountCreate>(EMPTY);
  const [showSecrets, setShowSecrets] = useState({
    token: false,
    secret: false,
    verify: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [account, setAccount] = useState<WhatsAppAccount | null>(
    initialAccount ?? null,
  );
  const [verifyTokenShown, setVerifyTokenShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setConfirmed(false);
    setTestFeedback(null);
    setVerifyTokenShown(null);
    if (initialAccount) {
      setAccount(initialAccount);
      setStep(3);
    } else {
      setAccount(null);
      setForm({
        ...EMPTY,
        verify_token: generateVerifyToken(),
      });
    }
  }, [open, initialAccount]);

  const update = <K extends keyof WhatsAppAccountCreate>(
    key: K,
    value: WhatsAppAccountCreate[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload: WhatsAppAccountCreate = {
        ...form,
        phone_e164: normalizePhone(form.phone_e164),
        phone_number_id: form.phone_number_id.replace(/\s/g, ''),
        business_account_id: form.business_account_id.replace(/\s/g, ''),
        app_id: form.app_id.replace(/\s/g, ''),
        access_token: form.access_token
          .trim()
          .replace(/^Bearer\s+/i, ''),
      };
      const created = await whatsappApi.create(payload);
      setAccount(created);
      setVerifyTokenShown(payload.verify_token);
      if (created.is_verified_credentials) {
        onConnected(created);
        setStep(3);
      } else {
        setError(
          created.last_error ||
            'Kimlik bilgileri doğrulanamadı. Lütfen kontrol edin.',
        );
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? typeof e.data === 'object' && e.data
            ? (e.data as { detail?: string }).detail || e.message
            : e.message
          : 'Beklenmeyen bir hata oluştu.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetestCredentials = async () => {
    if (!account) return;
    setTesting(true);
    setError(null);
    try {
      const result = await whatsappApi.test(account.id);
      // Refresh account row
      const fresh = await whatsappApi.get();
      if (fresh) setAccount(fresh);
      if (!result.ok) setError(result.detail || 'Doğrulama başarısız.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!account || !testNumber) return;
    setSendingTest(true);
    setTestFeedback(null);
    try {
      const result = await whatsappApi.sendTest(account.id, {
        to_phone_e164: normalizePhone(testNumber),
        template_name: 'hello_world',
        language: 'en_US',
      });
      setTestFeedback({
        ok: result.ok,
        msg: result.detail || (result.ok ? 'Gönderildi.' : 'Hata.'),
      });
      if (result.ok) {
        const fresh = await whatsappApi.get();
        if (fresh) {
          setAccount(fresh);
          onConnected(fresh);
        }
      }
    } catch (e) {
      setTestFeedback({
        ok: false,
        msg: e instanceof Error ? e.message : 'Hata',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const copy = (value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>WhatsApp Business API Bağlantısı</DialogTitle>
          <DialogDescription>
            Adım {step} / 3 — KOBİ WhatsApp Business numaranızı Meta Cloud API
            üzerinden bağlayın.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {step === 1 && <StepIntro confirmed={confirmed} setConfirmed={setConfirmed} />}

          {step === 2 && (
            <StepForm
              form={form}
              update={update}
              showSecrets={showSecrets}
              setShowSecrets={setShowSecrets}
              regenerateVerifyToken={() =>
                update('verify_token', generateVerifyToken())
              }
              error={error}
            />
          )}

          {step === 3 && account && (
            <StepWebhook
              account={account}
              verifyToken={verifyTokenShown}
              copy={copy}
              testNumber={testNumber}
              setTestNumber={setTestNumber}
              onSendTest={handleSendTest}
              sendingTest={sendingTest}
              testFeedback={testFeedback}
              onRetest={handleRetestCredentials}
              testing={testing}
              error={error}
            />
          )}
        </DialogBody>

        <DialogFooter>
          {step === 1 && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button disabled={!confirmed} onClick={() => setStep(2)}>
                Devam et
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Geri
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="size-4 me-2 animate-spin" />}
                Doğrula ve Kaydet
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Sonra
              </Button>
              <Button onClick={() => onOpenChange(false)}>Tamam</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------- step 1

function StepIntro({
  confirmed,
  setConfirmed,
}: {
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Devam etmeden önce Meta tarafında aşağıdakileri tamamlamış olmanız
        gerekir. Eksik bir adım varsa Meta sayfasına gidip yapın, sonra bu
        sihirbaza dönün.
      </p>
      <ol className="space-y-3 text-sm">
        <Prereq
          title="Meta Business hesabınız var"
          link={{ href: 'https://business.facebook.com', label: 'business.facebook.com' }}
          desc="Yoksa hesap oluşturun ve gerekiyorsa işletme doğrulaması yapın."
        />
        <Prereq
          title="Bir WhatsApp Business App'iniz var"
          link={{
            href: 'https://developers.facebook.com/apps',
            label: 'developers.facebook.com/apps',
          }}
          desc="My Apps → Create App → Business → WhatsApp ürününü ekleyin."
        />
        <Prereq
          title="WhatsApp numaranız Meta'ya kayıtlı ve doğrulanmış"
          link={{
            href: 'https://business.facebook.com/wa/manage/phone-numbers/',
            label: 'WhatsApp Manager',
          }}
          desc="Numarayı eklemeden önce kişisel/Business uygulamalardan çıkmış olmalı."
        />
        <Prereq
          title="Kalıcı (Permanent) Access Token ürettiniz"
          desc="Meta Business → System Users → Admin → Generate Token. Test token (24 saat) çalışmaz."
        />
        <Prereq
          title="App Secret değerine erişebiliyorsunuz"
          desc="App Dashboard → Settings → Basic → App Secret (Show)."
        />
      </ol>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>Yukarıdaki adımları tamamladım, devam etmek istiyorum.</span>
      </label>
    </div>
  );
}

function Prereq({
  title,
  desc,
  link,
}: {
  title: string;
  desc: string;
  link?: { href: string; label: string };
}) {
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-muted-foreground" />
        {title}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline"
        >
          {link.label} <ExternalLink className="size-3" />
        </a>
      )}
    </li>
  );
}

// ----------------------------------------------------------------- step 2

interface StepFormProps {
  form: WhatsAppAccountCreate;
  update: <K extends keyof WhatsAppAccountCreate>(
    key: K,
    value: WhatsAppAccountCreate[K],
  ) => void;
  showSecrets: { token: boolean; secret: boolean; verify: boolean };
  setShowSecrets: (
    v: { token: boolean; secret: boolean; verify: boolean },
  ) => void;
  regenerateVerifyToken: () => void;
  error: string | null;
}

function StepForm({
  form,
  update,
  showSecrets,
  setShowSecrets,
  regenerateVerifyToken,
  error,
}: StepFormProps) {
  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <FormField label="Görünen Ad" hint="Panelde göstereceğiz, sadece etiket.">
        <Input
          autoComplete="off"
          value={form.display_name}
          onChange={(e) => update('display_name', e.target.value)}
          placeholder="WhatsApp — Mağazam"
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="WhatsApp İşletme Numarası"
          hint="E.164 (ör. +905551234567)"
        >
          <Input
            autoComplete="off"
            value={form.phone_e164}
            onChange={(e) => update('phone_e164', e.target.value)}
            placeholder="+905551234567"
          />
        </FormField>
        <FormField
          label="Phone Number ID"
          hint="Meta App Dashboard → WhatsApp → API Setup."
        >
          <Input
            autoComplete="off"
            inputMode="numeric"
            value={form.phone_number_id}
            onChange={(e) => update('phone_number_id', e.target.value)}
            placeholder="123456789012345"
          />
        </FormField>
        <FormField
          label="WABA ID"
          hint="WhatsApp Business Account ID. Meta Business Settings."
        >
          <Input
            autoComplete="off"
            inputMode="numeric"
            value={form.business_account_id}
            onChange={(e) => update('business_account_id', e.target.value)}
            placeholder="123456789012345"
          />
        </FormField>
        <FormField
          label="App ID"
          hint="App Dashboard → Settings → Basic."
        >
          <Input
            autoComplete="off"
            inputMode="numeric"
            value={form.app_id}
            onChange={(e) => update('app_id', e.target.value)}
            placeholder="1234567890123456"
          />
        </FormField>
      </div>

      <FormField
        label="Permanent Access Token"
        hint="Meta Business → System Users → Generate Token."
      >
        <SecretInput
          value={form.access_token}
          onChange={(v) => update('access_token', v)}
          show={showSecrets.token}
          toggle={() =>
            setShowSecrets({ ...showSecrets, token: !showSecrets.token })
          }
          placeholder="EAAG..."
        />
      </FormField>

      <FormField
        label="App Secret"
        hint="App Dashboard → Settings → Basic → App Secret."
      >
        <SecretInput
          value={form.app_secret}
          onChange={(v) => update('app_secret', v)}
          show={showSecrets.secret}
          toggle={() =>
            setShowSecrets({ ...showSecrets, secret: !showSecrets.secret })
          }
          placeholder="32 char hex"
        />
      </FormField>

      <FormField
        label="Webhook Verify Token"
        hint="Sizin belirleyeceğiniz rastgele bir string. Meta'da aynısını gireceksiniz."
      >
        <div className="flex gap-2">
          <SecretInput
            value={form.verify_token}
            onChange={(v) => update('verify_token', v)}
            show={showSecrets.verify}
            toggle={() =>
              setShowSecrets({ ...showSecrets, verify: !showSecrets.verify })
            }
            placeholder="rastgele 16-64 char"
          />
          <Button
            type="button"
            variant="outline"
            onClick={regenerateVerifyToken}
          >
            Üret
          </Button>
        </div>
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Graph API Sürümü">
          <Select
            value={form.api_version}
            onValueChange={(v) => update('api_version', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v25.0">v25.0</SelectItem>
              <SelectItem value="v21.0">v21.0</SelectItem>
              <SelectItem value="v20.0">v20.0</SelectItem>
              <SelectItem value="v19.0">v19.0</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Varsayılan Dil">
          <Select
            value={form.default_language}
            onValueChange={(v) =>
              update('default_language', v as 'tr' | 'en_US')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tr">Türkçe (tr)</SelectItem>
              <SelectItem value="en_US">English (en_US)</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SecretInput({
  value,
  onChange,
  show,
  toggle,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggle: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full">
      <Input
        autoComplete="new-password"
        spellCheck={false}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pe-9"
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
      <AlertCircle className="size-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ----------------------------------------------------------------- step 3

interface StepWebhookProps {
  account: WhatsAppAccount;
  verifyToken: string | null;
  copy: (v: string) => void;
  testNumber: string;
  setTestNumber: (v: string) => void;
  onSendTest: () => void;
  sendingTest: boolean;
  testFeedback: { ok: boolean; msg: string } | null;
  onRetest: () => void;
  testing: boolean;
  error: string | null;
}

function StepWebhook({
  account,
  verifyToken,
  copy,
  testNumber,
  setTestNumber,
  onSendTest,
  sendingTest,
  testFeedback,
  onRetest,
  testing,
  error,
}: StepWebhookProps) {
  return (
    <div className="space-y-5">
      <CredentialStatus account={account} onRetest={onRetest} testing={testing} />

      {error && <ErrorBanner message={error} />}

      <div className="rounded-md border border-border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Webhook ayarları (Meta tarafı)</h4>
        <p className="text-xs text-muted-foreground">
          Aşağıdaki URL ve Verify Token'ı Meta App Dashboard → WhatsApp →
          Configuration → Webhook ekranına yapıştırın. Subscribe edilecek alanlar:{' '}
          <code className="text-xs px-1 rounded bg-muted">messages</code>,{' '}
          <code className="text-xs px-1 rounded bg-muted">
            message_template_status_update
          </code>
          .
        </p>
        <CopyRow label="Callback URL" value={account.webhook_url} onCopy={copy} />
        <CopyRow
          label="Verify Token"
          value={verifyToken ?? 'Verify Token sadece bağlandıktan sonra burada görüntülenir. Yeniden bağlanmanız gerekir.'}
          onCopy={copy}
          disabled={!verifyToken}
        />
        <p className="text-xs text-muted-foreground">
          Verify Token sadece bu sihirbazı kapatana kadar görünür; sonra şifreli
          olarak saklanır. Lütfen şimdi kopyalayıp Meta'ya yapıştırın. Kaybederseniz
          "Yeniden Bağla" ile yenisini üretebilirsiniz.
        </p>
      </div>

      <div className="rounded-md border border-border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Test mesajı gönder</h4>
        <p className="text-xs text-muted-foreground">
          Aşağıdaki numaraya{' '}
          <code className="text-xs px-1 rounded bg-muted">hello_world</code>{' '}
          template'i gönderilir. Numara Meta'da test numarası olarak kayıtlı veya
          son 24 saatte size yazmış olmalı.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="+905551234567"
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
          />
          <Button
            onClick={onSendTest}
            disabled={sendingTest || !testNumber}
          >
            {sendingTest && <Loader2 className="size-4 me-2 animate-spin" />}
            Gönder
          </Button>
        </div>
        {testFeedback && (
          <div
            className={`text-xs rounded-md px-3 py-2 ${
              testFeedback.ok
                ? 'bg-success/10 text-success border border-success/30'
                : 'bg-destructive/5 text-destructive border border-destructive/30'
            }`}
          >
            {testFeedback.msg}
          </div>
        )}
      </div>
    </div>
  );
}

function CredentialStatus({
  account,
  onRetest,
  testing,
}: {
  account: WhatsAppAccount;
  onRetest: () => void;
  testing: boolean;
}) {
  const ok = account.is_verified_credentials;
  return (
    <div
      className={`rounded-md border p-3 flex items-center justify-between ${
        ok
          ? 'border-success/30 bg-success/5'
          : 'border-destructive/30 bg-destructive/5'
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        {ok ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : (
          <AlertCircle className="size-4 text-destructive" />
        )}
        <span>
          {ok
            ? 'Kimlik bilgileri doğrulandı'
            : 'Kimlik bilgileri doğrulanamadı'}
          {' — '}
          <span className="text-muted-foreground">
            Token: •••• {account.access_token_last4}
          </span>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetest}
        disabled={testing}
      >
        {testing ? (
          <Loader2 className="size-3.5 me-1 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5 me-1" />
        )}
        Yeniden Test Et
      </Button>
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  disabled,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy(value)}
          disabled={disabled}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default WhatsAppConnectModal;
