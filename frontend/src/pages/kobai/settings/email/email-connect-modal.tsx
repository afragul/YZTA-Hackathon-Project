import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Mail,
  Send,
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
import { ApiError } from '@/lib/api-client';
import {
  emailApi,
  type EmailProvider,
  type EmailProviderCreate,
} from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider?: EmailProvider | null;
  onSaved: (row: EmailProvider) => void;
}

interface FormState {
  display_name: string;
  api_key: string;
  sender_name: string;
  sender_email: string;
  enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  display_name: 'Brevo',
  api_key: '',
  sender_name: '',
  sender_email: '',
  enabled: true,
};

export function EmailConnectModal({
  open,
  onOpenChange,
  initialProvider,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  // Send test state
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFeedback(null);
    setTestFeedback(null);
    setShowKey(false);
    if (initialProvider) {
      setForm({
        display_name: initialProvider.display_name,
        api_key: '',
        sender_name: initialProvider.sender_name,
        sender_email: initialProvider.sender_email,
        enabled: initialProvider.enabled,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [open, initialProvider]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    setFeedback(null);
    setSubmitting(true);
    try {
      const payload: EmailProviderCreate = {
        provider: 'brevo',
        api_key: form.api_key.trim(),
        sender_name: form.sender_name.trim(),
        sender_email: form.sender_email.trim(),
        display_name: form.display_name || undefined,
        enabled: form.enabled,
      };
      if (!payload.api_key) {
        setError('API anahtarı zorunlu.');
        setSubmitting(false);
        return;
      }
      if (payload.api_key.toLowerCase().startsWith('xsmtpsib-')) {
        setError(
          'Bu bir SMTP anahtarı. Brevo transactional e-posta API\'si v3 API anahtarı gerektirir (xkeysib-… ile başlar). Brevo panelinden yeni bir v3 API anahtarı oluşturup tekrar deneyin.',
        );
        setSubmitting(false);
        return;
      }
      if (!payload.sender_name || !payload.sender_email) {
        setError('Gönderici adı ve e-posta adresi zorunlu.');
        setSubmitting(false);
        return;
      }
      const saved = await emailApi.upsert(payload);
      if (saved.status === 'connected') {
        setFeedback({
          ok: true,
          msg: 'Brevo bağlantısı başarılı! Artık e-posta gönderebilirsiniz.',
        });
      } else {
        setFeedback({
          ok: false,
          msg:
            saved.last_error ||
            'API anahtarı doğrulanamadı. Lütfen kontrol edin.',
        });
      }
      onSaved(saved);
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

  const handleTest = async () => {
    if (!initialProvider) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const r = await emailApi.test(initialProvider.id);
      setFeedback({
        ok: r.ok,
        msg: r.detail || (r.ok ? 'Bağlantı doğrulandı.' : 'Test başarısız.'),
      });
    } catch (e) {
      setFeedback({
        ok: false,
        msg: e instanceof Error ? e.message : 'Hata',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTest = async () => {
    if (!initialProvider || !testEmail.trim()) return;
    setSendingTest(true);
    setTestFeedback(null);
    try {
      const r = await emailApi.sendTest(initialProvider.id, {
        to_email: testEmail.trim(),
      });
      setTestFeedback({
        ok: r.ok,
        msg: r.ok
          ? `Test e-postası gönderildi${r.message_id ? ` (ID: ${r.message_id})` : ''}.`
          : r.detail || 'Gönderim başarısız.',
      });
    } catch (e) {
      setTestFeedback({
        ok: false,
        msg: e instanceof Error ? e.message : 'Hata',
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Brevo E-posta Bağlantısı
          </DialogTitle>
          <DialogDescription>
            Brevo (eski adıyla Sendinblue) üzerinden transactional e-posta
            göndermek için API anahtarınızı ve gönderici bilgilerinizi girin.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error && <ErrorBanner message={error} />}
          {feedback && (
            <div
              className={`text-xs rounded-md px-3 py-2 ${
                feedback.ok
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-destructive/5 text-destructive border border-destructive/30'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <FormField label="Görünen Ad" hint="Panelde göstereceğiz.">
            <Input
              autoComplete="off"
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
            />
          </FormField>

          <FormField
            label="Brevo API Anahtarı"
            hint={
              <span>
                <strong>v3 API anahtarı</strong> gerekli (
                <code className="text-[10px]">xkeysib-…</code> ile başlar). SMTP
                anahtarı (
                <code className="text-[10px]">xsmtpsib-…</code>) burada
                çalışmaz. Anahtarı{' '}
                <a
                  href="https://app.brevo.com/settings/keys/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Brevo → SMTP & API → API Keys
                  <ExternalLink className="size-3" />
                </a>{' '}
                üzerinden alın. Şifrelenmiş olarak saklanır.
              </span>
            }
          >
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                autoComplete="new-password"
                spellCheck={false}
                value={form.api_key}
                onChange={(e) => update('api_key', e.target.value)}
                placeholder={
                  initialProvider
                    ? `•••• ${initialProvider.api_key_last4} (yenisini girin)`
                    : 'xkeysib-...'
                }
                className="pe-9"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Gönderici Adı"
              hint="E-postalarda görünecek isim."
            >
              <Input
                autoComplete="off"
                value={form.sender_name}
                onChange={(e) => update('sender_name', e.target.value)}
                placeholder="YZTA Mağaza"
              />
            </FormField>
            <FormField
              label="Gönderici E-posta"
              hint="Brevo'da doğrulanmış olmalı."
            >
              <Input
                type="email"
                autoComplete="off"
                value={form.sender_email}
                onChange={(e) => update('sender_email', e.target.value)}
                placeholder="noreply@yourdomain.com"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            <span>Aktif (sistem e-postaları bu provider üzerinden gönderilsin)</span>
          </label>

          {/* Send test email section — only when already connected */}
          {initialProvider && initialProvider.status === 'connected' && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Test E-postası Gönder</p>
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
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleSendTest}
                  disabled={sendingTest || !testEmail.trim()}
                >
                  {sendingTest ? (
                    <Loader2 className="size-4 me-2 animate-spin" />
                  ) : (
                    <Send className="size-4 me-2" />
                  )}
                  Gönder
                </Button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          {initialProvider && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 me-2 animate-spin" />}
              Test Et
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 me-2 animate-spin" />}
            Doğrula ve Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground">
          {typeof hint === 'string' ? hint : hint}
        </p>
      )}
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

export default EmailConnectModal;
