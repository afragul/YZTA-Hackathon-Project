import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Sparkles,
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
  aiApi,
  type AiModelInfo,
  type AiProvider,
  type AiProviderCode,
  type AiProviderCreate,
} from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider?: AiProvider | null;
  onSaved: (row: AiProvider) => void;
}

interface FormState {
  provider: AiProviderCode;
  display_name: string;
  api_key: string;
  model: string;
  max_tokens: number;
  enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  provider: 'google',
  display_name: 'Google Gemini',
  api_key: '',
  model: 'gemini-2.5-flash',
  max_tokens: 2048,
  enabled: true,
};

const PROVIDER_DOCS: Record<
  AiProviderCode,
  { label: string; helpHref: string; helpLabel: string; placeholder: string }
> = {
  google: {
    label: 'Google Gemini',
    helpHref: 'https://aistudio.google.com/app/apikey',
    helpLabel: 'Google AI Studio → API Keys',
    placeholder: 'AIza...',
  },
  openai: {
    label: 'OpenAI',
    helpHref: 'https://platform.openai.com/api-keys',
    helpLabel: 'platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic Claude',
    helpHref: 'https://console.anthropic.com/settings/keys',
    helpLabel: 'console.anthropic.com',
    placeholder: 'sk-ant-...',
  },
};

export function AiConnectModal({
  open,
  onOpenChange,
  initialProvider,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [modelSource, setModelSource] = useState<'api' | 'static' | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFeedback(null);
    setShowKey(false);
    if (initialProvider) {
      setForm({
        provider: initialProvider.provider,
        display_name: initialProvider.display_name,
        api_key: '',
        model: initialProvider.model,
        max_tokens: initialProvider.max_tokens,
        enabled: initialProvider.enabled,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [open, initialProvider]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const refreshModels = async (provider: AiProviderCode) => {
    setLoadingModels(true);
    try {
      const result = await aiApi.listModels(provider);
      setModels(result.models);
      setModelSource(result.source);
    } catch {
      setModels([]);
      setModelSource('static');
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshModels(form.provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.provider]);

  const handleSubmit = async () => {
    setError(null);
    setFeedback(null);
    setSubmitting(true);
    try {
      const payload: AiProviderCreate = {
        provider: form.provider,
        model: form.model,
        api_key: form.api_key.trim().replace(/^Bearer\s+/i, ''),
        max_tokens: form.max_tokens,
        display_name: form.display_name || undefined,
        enabled: form.enabled,
      };
      if (!payload.api_key) {
        setError('API anahtarı zorunlu.');
        setSubmitting(false);
        return;
      }
      const saved = await aiApi.upsert(payload);
      if (saved.status === 'connected') {
        setFeedback({
          ok: true,
          msg: 'Bağlandı. Modeli artık ajanlarda kullanabilirsiniz.',
        });
      } else {
        setFeedback({
          ok: false,
          msg:
            saved.last_error ||
            'Anahtar veya model doğrulanamadı. Test sonucunu kontrol edin.',
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
      const r = await aiApi.test(initialProvider.id);
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

  const docs = PROVIDER_DOCS[form.provider];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            AI Provider Bağlantısı (LangChain)
          </DialogTitle>
          <DialogDescription>
            Ajanlarımız LangChain üstünden bu provider'a bağlanır. Şimdilik{' '}
            <strong>Gemini</strong> aktif, diğerleri hazırlık aşamasında.
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

          <FormField label="Sağlayıcı">
            <Select
              value={form.provider}
              onValueChange={(v) => {
                const p = v as AiProviderCode;
                update('provider', p);
                update('display_name', PROVIDER_DOCS[p].label);
                update(
                  'model',
                  p === 'google'
                    ? 'gemini-2.5-flash'
                    : p === 'openai'
                      ? 'gpt-4o-mini'
                      : 'claude-haiku-4-20250414',
                );
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Gemini</SelectItem>
                <SelectItem value="openai" disabled>
                  OpenAI (yakında)
                </SelectItem>
                <SelectItem value="anthropic" disabled>
                  Anthropic Claude (yakında)
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Görünen Ad" hint="Panelde göstereceğiz.">
            <Input
              autoComplete="off"
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
            />
          </FormField>

          <FormField
            label="API Anahtarı"
            hint={
              <span>
                Anahtarı{' '}
                <a
                  href={docs.helpHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  {docs.helpLabel}
                  <ExternalLink className="size-3" />
                </a>{' '}
                üzerinden alabilirsiniz. Şifrelenmiş olarak saklanır.
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
                    : docs.placeholder
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
              label="Model"
              hint={
                modelSource === 'api'
                  ? "Provider API'sinden çekildi."
                  : 'Sağlayıcı listesi (statik).'
              }
            >
              <Select
                value={form.model}
                onValueChange={(v) => update('model', v)}
                disabled={loadingModels}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingModels ? 'Yükleniyor…' : 'Seçin'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Max Output Tokens">
              <Input
                type="number"
                min={64}
                max={131072}
                value={form.max_tokens}
                onChange={(e) =>
                  update('max_tokens', Number(e.target.value) || 2048)
                }
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            <span>Aktif (ajanlar tarafından kullanılabilsin)</span>
          </label>
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

export default AiConnectModal;
