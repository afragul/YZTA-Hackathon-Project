import { useEffect, useState } from 'react';
import {
  Bot,
  Headset,
  LoaderCircleIcon,
  MessageCircleQuestion,
  Package,
  Pencil,
  ShoppingCart,
} from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Container } from '@/components/common/container';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
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
import { agentsApi, type AgentPrompt } from './agents/api';
import { AgentPromptModal } from './agents/agent-prompt-modal';

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  supervisor: Bot,
  greeting: MessageCircleQuestion,
  product_info: Package,
  order: ShoppingCart,
  escalation: Headset,
};

export function WhatsappAgentsPage() {
  const [agents, setAgents] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgentPrompt | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await agentsApi.list();
      setAgents(list);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Agentlar yüklenemedi.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleEdit = (agent: AgentPrompt) => {
    setEditing(agent);
    setModalOpen(true);
  };

  return (
    <>
      <PageHeader
        title={
          <FormattedMessage
            id="SETTINGS.WHATSAPP_AGENTS.TITLE"
            defaultMessage="WhatsApp AI Agentları"
          />
        }
        description={
          <FormattedMessage
            id="SETTINGS.WHATSAPP_AGENTS.SUBTITLE"
            defaultMessage="WhatsApp üzerinden gelen mesajlara cevap veren AI agentlarını yapılandırın."
          />
        }
      />

      <Container>
        {loading && (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <FormattedMessage id="COMMON.LOADING" defaultMessage="Yükleniyor..." />
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive" appearance="light" className="mb-4">
            <AlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const Icon = AGENT_ICONS[agent.key] || Bot;
              return (
                <Card key={agent.key}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          <span>{agent.name}</span>
                          {agent.is_custom && (
                            <Badge variant="primary" appearance="light">
                              <FormattedMessage
                                id="AGENTS.CUSTOMIZED"
                                defaultMessage="Özelleştirilmiş"
                              />
                            </Badge>
                          )}
                          {!agent.enabled && (
                            <Badge variant="secondary" appearance="light">
                              <FormattedMessage
                                id="AGENTS.DISABLED"
                                defaultMessage="Pasif"
                              />
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {agent.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {agent.tools.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <FormattedMessage
                            id="AGENTS.TOOLS"
                            defaultMessage="Araçlar"
                          />
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.tools.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              appearance="light"
                            >
                              <code className="text-xs font-mono">{t}</code>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <FormattedMessage
                          id="AGENTS.PROMPT_PREVIEW"
                          defaultMessage="Prompt Önizleme"
                        />
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {agent.prompt}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(agent)}
                    >
                      <Pencil className="size-3.5" />
                      <FormattedMessage
                        id="AGENTS.EDIT_PROMPT"
                        defaultMessage="Prompt'u Düzenle"
                      />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </Container>

      <AgentPromptModal
        open={modalOpen}
        agent={editing}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />
    </>
  );
}
