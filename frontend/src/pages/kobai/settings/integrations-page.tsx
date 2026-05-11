import { useEffect, useState, type ReactNode } from 'react';
import { Truck } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { PageHeader } from '../components/page-header';
import { aiApi, type AiProvider } from './ai/api';
import { AiConnectModal } from './ai/ai-connect-modal';
import { emailApi, type EmailProvider } from './email/api';
import { EmailConnectModal } from './email/email-connect-modal';
import { whatsappApi, type WhatsAppAccount } from './whatsapp/api';
import { WhatsAppConnectModal } from './whatsapp/whatsapp-connect-modal';

type StatusKind = 'connected' | 'pending' | 'error' | 'idle' | 'loading';

interface StatusBadgeProps {
  kind: StatusKind;
  label?: string;
}

function StatusBadge({ kind, label }: StatusBadgeProps) {
  if (kind === 'loading') {
    return (
      <Badge variant="secondary" appearance="light" size="sm">
        Yükleniyor…
      </Badge>
    );
  }
  if (kind === 'connected') {
    return (
      <Badge variant="success" appearance="light" size="sm">
        {label ?? 'Bağlandı'}
      </Badge>
    );
  }
  if (kind === 'error') {
    return (
      <Badge variant="destructive" appearance="light" size="sm">
        {label ?? 'Hata'}
      </Badge>
    );
  }
  if (kind === 'pending') {
    return (
      <Badge variant="warning" appearance="light" size="sm">
        {label ?? 'Doğrulama bekliyor'}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" appearance="light" size="sm">
      <FormattedMessage id="SETTINGS.INTEGRATIONS.NOT_CONNECTED" />
    </Badge>
  );
}

interface IntegrationCardProps {
  logo: ReactNode;
  title: string;
  subtitle?: string;
  status: StatusKind;
  statusLabel?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

function IntegrationCard({
  logo,
  title,
  subtitle,
  status,
  statusLabel,
  children,
  footer,
}: IntegrationCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="!min-h-0 py-5 border-b-0 items-center">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 shrink-0 rounded-lg bg-muted/40 border flex items-center justify-center overflow-hidden">
              {logo}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-tight truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <StatusBadge kind={status} label={statusLabel} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">{children}</CardContent>
      {footer && (
        <CardFooter className="justify-end gap-2 pt-2">{footer}</CardFooter>
      )}
    </Card>
  );
}

interface StaticIntegration {
  id: string;
  name: string;
  descriptionId: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATIC_INTEGRATIONS: StaticIntegration[] = [
  {
    id: 'shipping',
    name: 'Yurtiçi / Aras / MNG',
    descriptionId: 'SETTINGS.INTEGRATIONS.SHIPPING_DESC',
    icon: Truck,
  },
];

export function IntegrationsPage() {
  const [whatsapp, setWhatsapp] = useState<WhatsAppAccount | null>(null);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  const [aiProviders, setAiProviders] = useState<AiProvider[]>([]);
  const [loadingAi, setLoadingAi] = useState(true);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [emailProviders, setEmailProviders] = useState<EmailProvider[]>([]);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const refreshWhatsapp = async () => {
    setLoadingWhatsapp(true);
    setWhatsappError(null);
    try {
      const account = await whatsappApi.get();
      setWhatsapp(account);
    } catch (e) {
      setWhatsappError(
        e instanceof ApiError
          ? e.message
          : 'WhatsApp entegrasyonu yüklenemedi.',
      );
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const refreshAi = async () => {
    setLoadingAi(true);
    setAiError(null);
    try {
      const providers = await aiApi.list();
      setAiProviders(providers);
    } catch (e) {
      setAiError(
        e instanceof ApiError ? e.message : 'AI sağlayıcılar yüklenemedi.',
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const refreshEmail = async () => {
    setLoadingEmail(true);
    setEmailError(null);
    try {
      const providers = await emailApi.list();
      setEmailProviders(providers);
    } catch (e) {
      setEmailError(
        e instanceof ApiError ? e.message : 'Email sağlayıcılar yüklenemedi.',
      );
    } finally {
      setLoadingEmail(false);
    }
  };

  useEffect(() => {
    refreshWhatsapp();
    refreshAi();
    refreshEmail();
  }, []);

  const handleDisconnectWhatsapp = async () => {
    if (!whatsapp) return;
    if (!confirm('WhatsApp bağlantısını kaldırmak istediğinizden emin misiniz?'))
      return;
    try {
      await whatsappApi.disconnect(whatsapp.id);
      await refreshWhatsapp();
    } catch (e) {
      setWhatsappError(
        e instanceof ApiError ? e.message : 'Bağlantı kaldırılamadı.',
      );
    }
  };

  const handleDisconnectAi = async (row: AiProvider) => {
    if (!confirm(`${row.display_name} bağlantısı kaldırılsın mı?`)) return;
    try {
      await aiApi.disconnect(row.id);
      await refreshAi();
    } catch (e) {
      setAiError(e instanceof ApiError ? e.message : 'Bağlantı kaldırılamadı.');
    }
  };

  const handleDisconnectEmail = async (row: EmailProvider) => {
    if (!confirm(`${row.display_name} bağlantısı kaldırılsın mı?`)) return;
    try {
      await emailApi.disconnect(row.id);
      await refreshEmail();
    } catch (e) {
      setEmailError(
        e instanceof ApiError ? e.message : 'Bağlantı kaldırılamadı.',
      );
    }
  };

  // ---------------- Status derivation ----------------
  const whatsappConnected =
    whatsapp != null &&
    whatsapp.status === 'connected' &&
    whatsapp.is_verified_credentials;

  const whatsappStatus: StatusKind = loadingWhatsapp
    ? 'loading'
    : whatsappConnected
      ? 'connected'
      : whatsapp
        ? whatsapp.status === 'error'
          ? 'error'
          : 'pending'
        : 'idle';

  const activeAi = aiProviders.find(
    (p) => p.is_default && p.enabled && p.status !== 'disconnected',
  );
  const aiConnected = !!activeAi && activeAi.status === 'connected';
  const aiStatus: StatusKind = loadingAi
    ? 'loading'
    : aiConnected
      ? 'connected'
      : activeAi
        ? activeAi.status === 'error'
          ? 'error'
          : 'pending'
        : 'idle';

  const activeEmail = emailProviders.find(
    (p) => p.is_default && p.enabled && p.status !== 'disconnected',
  );
  const emailConnected = !!activeEmail && activeEmail.status === 'connected';
  const emailStatus: StatusKind = loadingEmail
    ? 'loading'
    : emailConnected
      ? 'connected'
      : activeEmail
        ? activeEmail.status === 'error'
          ? 'error'
          : 'pending'
        : 'idle';

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.INTEGRATIONS.TITLE" />}
        description={<FormattedMessage id="SETTINGS.INTEGRATIONS.SUBTITLE" />}
      />

      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* WhatsApp */}
          <IntegrationCard
            logo={
              <img
                src="/media/app/wp-logo.png"
                alt="WhatsApp"
                className="size-9 object-contain"
              />
            }
            title="WhatsApp Business"
            subtitle="Meta Cloud API"
            status={whatsappStatus}
            footer={
              <>
                {whatsapp && (
                  <Button variant="outline" onClick={handleDisconnectWhatsapp}>
                    Bağlantıyı Kaldır
                  </Button>
                )}
                <Button
                  variant={whatsappConnected ? 'outline' : 'primary'}
                  onClick={() => setWhatsappModalOpen(true)}
                >
                  {whatsappConnected ? 'Yapılandır' : 'Bağla'}
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="SETTINGS.INTEGRATIONS.WHATSAPP_DESC" />
            </p>
            {whatsapp && (
              <dl className="text-xs text-muted-foreground grid grid-cols-[110px_1fr] gap-y-1.5 gap-x-3 mt-3">
                <dt>Numara</dt>
                <dd className="font-mono text-foreground">
                  {whatsapp.phone_e164}
                </dd>
                <dt>Phone Number ID</dt>
                <dd className="font-mono text-foreground truncate">
                  {whatsapp.phone_number_id}
                </dd>
                <dt>Token</dt>
                <dd className="font-mono text-foreground">
                  •••• {whatsapp.access_token_last4}
                </dd>
              </dl>
            )}
            {whatsapp?.last_error && !whatsappConnected && (
              <p className="text-xs text-destructive mt-2">
                {whatsapp.last_error}
              </p>
            )}
            {whatsappError && (
              <p className="text-xs text-destructive mt-2">{whatsappError}</p>
            )}
          </IntegrationCard>

          {/* AI Provider */}
          <IntegrationCard
            logo={
              <img
                src="/media/app/gemini.png"
                alt="Gemini"
                className="size-9 object-contain"
              />
            }
            title="AI Provider"
            subtitle={
              activeAi ? `${activeAi.display_name} • LangChain` : 'LangChain'
            }
            status={aiStatus}
            footer={
              <>
                {activeAi && (
                  <Button
                    variant="outline"
                    onClick={() => handleDisconnectAi(activeAi)}
                  >
                    Bağlantıyı Kaldır
                  </Button>
                )}
                <Button
                  variant={aiConnected ? 'outline' : 'primary'}
                  onClick={() => setAiModalOpen(true)}
                >
                  {aiConnected ? 'Yapılandır' : 'Bağla'}
                </Button>
              </>
            }
          >
            {!activeAi && (
              <p className="text-sm text-muted-foreground">
                Ajanların kullanacağı dil modeli sağlayıcısını seçin. Şu an
                Gemini destekleniyor.
              </p>
            )}
            {activeAi && (
              <dl className="text-xs text-muted-foreground grid grid-cols-[110px_1fr] gap-y-1.5 gap-x-3 mt-1">
                <dt>Sağlayıcı</dt>
                <dd className="font-mono text-foreground">
                  {activeAi.provider}
                </dd>
                <dt>Model</dt>
                <dd className="font-mono text-foreground truncate">
                  {activeAi.model}
                </dd>
                <dt>Max Tokens</dt>
                <dd className="font-mono text-foreground">
                  {activeAi.max_tokens}
                </dd>
                <dt>API Key</dt>
                <dd className="font-mono text-foreground">
                  •••• {activeAi.api_key_last4}
                </dd>
              </dl>
            )}
            {activeAi?.last_error && !aiConnected && (
              <p className="text-xs text-destructive mt-2">
                {activeAi.last_error}
              </p>
            )}
            {aiError && <p className="text-xs text-destructive mt-2">{aiError}</p>}
          </IntegrationCard>

          {/* Email Provider (Brevo) */}
          <IntegrationCard
            logo={
              <img
                src="/media/app/brevo.webp"
                alt="Brevo"
                className="size-9 object-contain"
              />
            }
            title="E-posta"
            subtitle="Brevo (Sendinblue)"
            status={emailStatus}
            footer={
              <>
                {activeEmail && (
                  <Button
                    variant="outline"
                    onClick={() => handleDisconnectEmail(activeEmail)}
                  >
                    Bağlantıyı Kaldır
                  </Button>
                )}
                <Button
                  variant={emailConnected ? 'outline' : 'primary'}
                  onClick={() => setEmailModalOpen(true)}
                >
                  {emailConnected ? 'Yapılandır' : 'Bağla'}
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">
              Sipariş bildirimleri, fatura ve pazarlama e-postalarını Brevo
              transactional API üzerinden gönderin.
            </p>
            {activeEmail && (
              <dl className="text-xs text-muted-foreground grid grid-cols-[110px_1fr] gap-y-1.5 gap-x-3 mt-3">
                <dt>Gönderici</dt>
                <dd className="font-mono text-foreground truncate">
                  {activeEmail.sender_name} &lt;{activeEmail.sender_email}&gt;
                </dd>
                <dt>API Key</dt>
                <dd className="font-mono text-foreground">
                  •••• {activeEmail.api_key_last4}
                </dd>
              </dl>
            )}
            {activeEmail?.last_error && !emailConnected && (
              <p className="text-xs text-destructive mt-2">
                {activeEmail.last_error}
              </p>
            )}
            {emailError && (
              <p className="text-xs text-destructive mt-2">{emailError}</p>
            )}
          </IntegrationCard>

          {/* Diğer entegrasyonlar — placeholder */}
          {STATIC_INTEGRATIONS.map((it) => (
            <IntegrationCard
              key={it.id}
              logo={<it.icon className="size-6 text-muted-foreground" />}
              title={it.name}
              status="idle"
              footer={
                <Button variant="primary" disabled>
                  <FormattedMessage id="SETTINGS.INTEGRATIONS.CONNECT" />
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                <FormattedMessage id={it.descriptionId} />
              </p>
            </IntegrationCard>
          ))}
        </div>
      </Container>

      <WhatsAppConnectModal
        open={whatsappModalOpen}
        onOpenChange={setWhatsappModalOpen}
        initialAccount={whatsapp}
        onConnected={(acc) => setWhatsapp(acc)}
      />

      <AiConnectModal
        open={aiModalOpen}
        onOpenChange={(open) => {
          setAiModalOpen(open);
          if (!open) refreshAi();
        }}
        initialProvider={activeAi ?? null}
        onSaved={(row) => {
          setAiProviders((prev) => {
            const without = prev.filter((p) => p.id !== row.id);
            return [row, ...without];
          });
        }}
      />

      <EmailConnectModal
        open={emailModalOpen}
        onOpenChange={(open) => {
          setEmailModalOpen(open);
          if (!open) refreshEmail();
        }}
        initialProvider={activeEmail ?? null}
        onSaved={(row) => {
          setEmailProviders((prev) => {
            const without = prev.filter((p) => p.id !== row.id);
            return [row, ...without];
          });
        }}
      />
    </>
  );
}
