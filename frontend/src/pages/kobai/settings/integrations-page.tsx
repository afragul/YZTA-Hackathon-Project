import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Sparkles, Truck } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { PageHeader } from '../components/page-header';
import { aiApi, type AiProvider } from './ai/api';
import { AiConnectModal } from './ai/ai-connect-modal';
import { whatsappApi, type WhatsAppAccount } from './whatsapp/api';
import { WhatsAppConnectModal } from './whatsapp/whatsapp-connect-modal';

interface StaticIntegration {
  id: string;
  name: string;
  descriptionId: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATIC_INTEGRATIONS: StaticIntegration[] = [
  {
    id: 'email',
    name: 'Email (SMTP)',
    descriptionId: 'SETTINGS.INTEGRATIONS.EMAIL_DESC',
    icon: Mail,
  },
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
      setAiError(e instanceof ApiError ? e.message : 'AI sağlayıcılar yüklenemedi.');
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    refreshWhatsapp();
    refreshAi();
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

  const whatsappConnected =
    whatsapp != null &&
    whatsapp.status === 'connected' &&
    whatsapp.is_verified_credentials;

  const activeAi = aiProviders.find(
    (p) => p.is_default && p.enabled && p.status !== 'disconnected',
  );
  const aiConnected = !!activeAi && activeAi.status === 'connected';

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.INTEGRATIONS.TITLE" />}
        description={<FormattedMessage id="SETTINGS.INTEGRATIONS.SUBTITLE" />}
      />

      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* WhatsApp */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                  <MessageCircle className="size-5" />
                </div>
                <div>
                  <CardTitle>WhatsApp Business</CardTitle>
                  <CardDescription>
                    {loadingWhatsapp ? (
                      <Badge variant="secondary" appearance="light" size="sm">
                        Yükleniyor…
                      </Badge>
                    ) : whatsappConnected ? (
                      <Badge variant="success" appearance="light" size="sm">
                        Bağlandı
                      </Badge>
                    ) : whatsapp ? (
                      <Badge variant="warning" appearance="light" size="sm">
                        {whatsapp.status === 'error'
                          ? 'Hata'
                          : 'Doğrulama bekliyor'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" appearance="light" size="sm">
                        <FormattedMessage id="SETTINGS.INTEGRATIONS.NOT_CONNECTED" />
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <FormattedMessage id="SETTINGS.INTEGRATIONS.WHATSAPP_DESC" />
              </p>
              {whatsapp && (
                <dl className="text-xs text-muted-foreground grid grid-cols-2 gap-1.5 mt-2">
                  <dt>Numara</dt>
                  <dd className="font-mono">{whatsapp.phone_e164}</dd>
                  <dt>Phone Number ID</dt>
                  <dd className="font-mono truncate">
                    {whatsapp.phone_number_id}
                  </dd>
                  <dt>Token</dt>
                  <dd className="font-mono">
                    •••• {whatsapp.access_token_last4}
                  </dd>
                </dl>
              )}
              {whatsapp?.last_error && !whatsappConnected && (
                <p className="text-xs text-destructive">{whatsapp.last_error}</p>
              )}
              {whatsappError && (
                <p className="text-xs text-destructive">{whatsappError}</p>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2">
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
            </CardFooter>
          </Card>

          {/* AI Provider */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <CardTitle>AI Provider (LangChain)</CardTitle>
                  <CardDescription>
                    {loadingAi ? (
                      <Badge variant="secondary" appearance="light" size="sm">
                        Yükleniyor…
                      </Badge>
                    ) : aiConnected ? (
                      <Badge variant="success" appearance="light" size="sm">
                        {activeAi!.display_name} • Bağlandı
                      </Badge>
                    ) : activeAi ? (
                      <Badge variant="warning" appearance="light" size="sm">
                        {activeAi.status === 'error'
                          ? 'Hata'
                          : 'Doğrulama bekliyor'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" appearance="light" size="sm">
                        <FormattedMessage id="SETTINGS.INTEGRATIONS.NOT_CONNECTED" />
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeAi && (
                <dl className="text-xs text-muted-foreground grid grid-cols-2 gap-1.5 mt-2">
                  <dt>Sağlayıcı</dt>
                  <dd className="font-mono">{activeAi.provider}</dd>
                  <dt>Model</dt>
                  <dd className="font-mono truncate">{activeAi.model}</dd>
                  <dt>Max Tokens</dt>
                  <dd className="font-mono">{activeAi.max_tokens}</dd>
                  <dt>API Key</dt>
                  <dd className="font-mono">•••• {activeAi.api_key_last4}</dd>
                </dl>
              )}
              {activeAi?.last_error && !aiConnected && (
                <p className="text-xs text-destructive">{activeAi.last_error}</p>
              )}
              {aiError && <p className="text-xs text-destructive">{aiError}</p>}
            </CardContent>
            <CardFooter className="justify-end gap-2">
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
            </CardFooter>
          </Card>

          {/* Diğer entegrasyonlar — placeholder */}
          {STATIC_INTEGRATIONS.map((it) => (
            <Card key={it.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                    <it.icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle>{it.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary" appearance="light" size="sm">
                        <FormattedMessage id="SETTINGS.INTEGRATIONS.NOT_CONNECTED" />
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  <FormattedMessage id={it.descriptionId} />
                </p>
              </CardContent>
              <CardFooter className="justify-end">
                <Button variant="primary" disabled>
                  <FormattedMessage id="SETTINGS.INTEGRATIONS.CONNECT" />
                </Button>
              </CardFooter>
            </Card>
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
    </>
  );
}
