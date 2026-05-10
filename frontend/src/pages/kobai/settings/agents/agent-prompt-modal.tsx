import { useEffect, useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { agentsApi, type AgentPrompt } from './api';

interface AgentPromptModalProps {
  open: boolean;
  agent: AgentPrompt | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AgentPromptModal({
  open,
  agent,
  onOpenChange,
  onSaved,
}: AgentPromptModalProps) {
  const intl = useIntl();
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) setPrompt(agent.prompt);
  }, [agent]);

  if (!agent) return null;

  const handleSave = async () => {
    if (!prompt.trim() || prompt.trim().length < 10) {
      toast.error(
        intl.formatMessage({
          id: 'AGENTS.PROMPT_TOO_SHORT',
          defaultMessage: 'Prompt en az 10 karakter olmalıdır.',
        }),
      );
      return;
    }
    setSaving(true);
    try {
      await agentsApi.update(agent.key, { prompt: prompt.trim() });
      toast.success(
        intl.formatMessage({
          id: 'AGENTS.SAVE_SUCCESS',
          defaultMessage: 'Prompt güncellendi.',
        }),
      );
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof ApiError
          ? e.message
          : intl.formatMessage({
              id: 'AGENTS.SAVE_ERROR',
              defaultMessage: 'Prompt kaydedilemedi.',
            }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent.name}</DialogTitle>
          <DialogDescription>{agent.description}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {agent.tools.length > 0 && (
            <div className="space-y-2">
              <Label>
                <FormattedMessage
                  id="AGENTS.TOOLS"
                  defaultMessage="Erişilebilir Araçlar"
                />
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((t) => (
                  <Badge key={t} variant="secondary" appearance="light">
                    <code className="text-xs font-mono">{t}</code>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">
              <FormattedMessage
                id="AGENTS.SYSTEM_PROMPT"
                defaultMessage="Sistem Prompt'u"
              />
            </Label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[400px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={intl.formatMessage({
                id: 'AGENTS.PROMPT_PLACEHOLDER',
                defaultMessage: 'Agent için sistem prompt\'unu yazın...',
              })}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length}{' '}
              <FormattedMessage
                id="AGENTS.CHARS"
                defaultMessage="karakter"
              />
              {agent.is_custom && (
                <>
                  {' · '}
                  <FormattedMessage
                    id="AGENTS.CUSTOMIZED"
                    defaultMessage="Özelleştirilmiş"
                  />
                </>
              )}
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <FormattedMessage id="SETTINGS.CANCEL" defaultMessage="Vazgeç" />
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <LoaderCircleIcon className="size-4 animate-spin" />}
            <FormattedMessage id="SETTINGS.SAVE" defaultMessage="Kaydet" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
