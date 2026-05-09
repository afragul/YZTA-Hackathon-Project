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
import { PageHeader } from '../components/page-header';

interface Integration {
  id: string;
  name: string;
  descriptionId: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    descriptionId: 'SETTINGS.INTEGRATIONS.WHATSAPP_DESC',
    icon: MessageCircle,
    connected: false,
  },
  {
    id: 'email',
    name: 'Email (SMTP)',
    descriptionId: 'SETTINGS.INTEGRATIONS.EMAIL_DESC',
    icon: Mail,
    connected: false,
  },
  {
    id: 'shipping',
    name: 'Yurtiçi / Aras / MNG',
    descriptionId: 'SETTINGS.INTEGRATIONS.SHIPPING_DESC',
    icon: Truck,
    connected: false,
  },
  {
    id: 'ai',
    name: 'AI Provider',
    descriptionId: 'SETTINGS.INTEGRATIONS.AI_DESC',
    icon: Sparkles,
    connected: false,
  },
];

export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.INTEGRATIONS.TITLE" />}
        description={<FormattedMessage id="SETTINGS.INTEGRATIONS.SUBTITLE" />}
      />

      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {INTEGRATIONS.map((it) => (
            <Card key={it.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                    <it.icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle>{it.name}</CardTitle>
                    <CardDescription>
                      <Badge
                        variant={it.connected ? 'success' : 'secondary'}
                        appearance="light"
                        size="sm"
                      >
                        <FormattedMessage
                          id={
                            it.connected
                              ? 'SETTINGS.INTEGRATIONS.CONNECTED'
                              : 'SETTINGS.INTEGRATIONS.NOT_CONNECTED'
                          }
                        />
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
                <Button variant={it.connected ? 'outline' : 'primary'}>
                  <FormattedMessage
                    id={
                      it.connected
                        ? 'SETTINGS.INTEGRATIONS.CONFIGURE'
                        : 'SETTINGS.INTEGRATIONS.CONNECT'
                    }
                  />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
