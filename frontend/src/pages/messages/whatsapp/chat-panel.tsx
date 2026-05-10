import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  BotOff,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MessageSquareDashed,
  Phone,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type ConversationStatus,
  type MessageStatus,
  type WhatsAppChatMessage,
  type WhatsAppConversation,
} from './api';
import {
  formatBubbleTime,
  formatDayDivider,
  formatPhone,
  initials,
} from './format';

interface Props {
  conversation: WhatsAppConversation | null;
  messages: WhatsAppChatMessage[];
  loadingMessages: boolean;
  sending: boolean;
  sendError: string | null;
  onSend: (body: string) => Promise<void>;
  onChangeStatus: (status: ConversationStatus) => Promise<void>;
  onToggleAi: (enabled: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ChatPanel({
  conversation,
  messages,
  loadingMessages,
  sending,
  sendError,
  onSend,
  onChangeStatus,
  onToggleAi,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft('');
  }, [conversation?.id]);

  // Auto-scroll to bottom when conversation changes or new messages arrive.
  // Triggers on length change AND last-message id change (covers same-length re-renders).
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Use rAF so the DOM is settled (especially after image loads or large bubbles)
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [conversation?.id, messages.length, lastMessageId]);

  if (!conversation) {
    return (
      <div className="grow flex items-center justify-center bg-muted/40">
        <div className="text-center text-muted-foreground max-w-sm">
          <MessageSquareDashed className="size-10 mx-auto mb-3 opacity-60" />
          <p className="text-sm font-medium text-foreground">
            Sol taraftan bir sohbet seçin
          </p>
          <p className="text-xs mt-1">
            WhatsApp Business hesabınıza gelen mesajlar burada görüntülenir.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    await onSend(trimmed);
    setDraft('');
  };

  const name =
    conversation.contact_name || formatPhone(conversation.wa_id);

  return (
    <section className="grow flex flex-col min-w-0 min-h-0 h-full bg-muted/30">
      <ChatHeader
        conversation={conversation}
        name={name}
        onChangeStatus={onChangeStatus}
        onToggleAi={onToggleAi}
        onDelete={onDelete}
      />

      <div
        ref={scrollerRef}
        className="grow min-h-0 overflow-y-auto px-4 py-4"
      >
        {loadingMessages && messages.length === 0 ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <EmptyChat />
        ) : (
          <MessagesList messages={messages} />
        )}
      </div>

      {conversation.status === 'closed' ? (
        <div className="border-t border-input bg-background px-4 py-3 text-center text-sm text-muted-foreground">
          Bu sohbet kapatıldı. Yeniden mesaj göndermek için durumu açın.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border-t border-input bg-background px-3 py-3 flex items-end gap-2"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mesaj yazın..."
            rows={1}
            className="resize-none min-h-[40px] max-h-[160px] grow"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as FormEvent);
              }
            }}
          />
          <Button
            type="submit"
            disabled={sending || !draft.trim()}
            mode="icon"
            size="lg"
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      )}
      {sendError && (
        <div className="border-t border-destructive/30 bg-destructive/5 text-destructive text-xs px-4 py-2 flex items-start gap-2">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}
    </section>
  );
}

function ChatHeader({
  conversation,
  name,
  onChangeStatus,
  onToggleAi,
  onDelete,
}: {
  conversation: WhatsAppConversation;
  name: string;
  onChangeStatus: (status: ConversationStatus) => Promise<void>;
  onToggleAi: (enabled: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const aiOn = conversation.ai_enabled;
  return (
    <header className="flex items-center justify-between gap-3 border-b border-input bg-background px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate text-sm">{name}</p>
            <StatusBadge status={conversation.status} />
            {aiOn && (
              <Badge
                variant="primary"
                appearance="light"
                size="sm"
                className="gap-1"
              >
                <Sparkles className="size-3" />
                AI Aktif
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="size-3" />
            {formatPhone(conversation.wa_id)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant={aiOn ? 'primary' : 'outline'}
          size="sm"
          onClick={() => void onToggleAi(!aiOn)}
          title={aiOn ? 'AI ajan kapat' : 'AI ajan aç'}
        >
          {aiOn ? (
            <>
              <Bot className="size-3.5" />
              AI Açık
            </>
          ) : (
            <>
              <BotOff className="size-3.5" />
              AI Kapalı
            </>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Durum: {statusLabel(conversation.status)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Sohbet durumu</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['open', 'pending', 'closed', 'spam'] as ConversationStatus[]).map(
              (s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (s !== conversation.status) {
                      void onChangeStatus(s);
                    }
                  }}
                  className={cn(
                    s === conversation.status && 'font-semibold',
                  )}
                >
                  {statusLabel(s)}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          mode="icon"
          onClick={() => void onDelete()}
          title="Sohbeti sil"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  if (status === 'open') {
    return (
      <Badge variant="success" appearance="light" size="sm">
        Açık
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant="warning" appearance="light" size="sm">
        Bekliyor
      </Badge>
    );
  }
  if (status === 'closed') {
    return (
      <Badge variant="secondary" appearance="light" size="sm">
        Kapalı
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" appearance="light" size="sm">
      Spam
    </Badge>
  );
}

function statusLabel(status: ConversationStatus): string {
  switch (status) {
    case 'open':
      return 'Açık';
    case 'pending':
      return 'Bekliyor';
    case 'closed':
      return 'Kapalı';
    case 'spam':
      return 'Spam';
  }
}

function MessagesList({ messages }: { messages: WhatsAppChatMessage[] }) {
  // Group messages by day
  const grouped: { day: string; items: WhatsAppChatMessage[] }[] = [];
  let currentDay: string | null = null;

  for (const m of messages) {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== currentDay) {
      grouped.push({ day: m.created_at, items: [] });
      currentDay = key;
    }
    grouped[grouped.length - 1].items.push(m);
  }

  return (
    <div className="space-y-4">
      {grouped.map((g, idx) => (
        <div key={idx} className="space-y-1.5">
          <div className="flex justify-center my-3">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground bg-background/80 backdrop-blur-sm border border-input rounded-full px-3 py-1">
              {formatDayDivider(g.day)}
            </span>
          </div>
          {g.items.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: WhatsAppChatMessage }) {
  const outbound = message.direction === 'outbound';
  const failed = message.status === 'failed';

  return (
    <div
      className={cn(
        'flex',
        outbound ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm relative',
          outbound
            ? 'bg-emerald-600 text-white rounded-tr-sm'
            : 'bg-background border border-input rounded-tl-sm',
          failed && 'opacity-80 ring-1 ring-destructive',
        )}
      >
        <MessageContent message={message} outbound={outbound} />
        <div
          className={cn(
            'flex items-center gap-1 justify-end text-[10px] mt-1',
            outbound ? 'text-emerald-100' : 'text-muted-foreground',
          )}
        >
          <span>{formatBubbleTime(message.created_at)}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
        {failed && message.error_message && (
          <p
            className={cn(
              'text-[11px] mt-1 border-t pt-1',
              outbound
                ? 'border-emerald-400/40 text-emerald-50'
                : 'border-destructive/30 text-destructive',
            )}
          >
            {message.error_message}
          </p>
        )}
      </div>
    </div>
  );
}

function MessageContent({
  message,
  outbound,
}: {
  message: WhatsAppChatMessage;
  outbound: boolean;
}) {
  if (message.kind === 'text' || !message.kind) {
    return (
      <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">
        {message.body || ''}
      </p>
    );
  }

  if (message.kind === 'image' && message.media_url) {
    return (
      <div className="space-y-1">
        <img
          src={message.media_url}
          alt="image"
          className="rounded-md max-w-[280px] max-h-[280px] object-cover"
        />
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[13.5px]">
            {message.body}
          </p>
        )}
      </div>
    );
  }

  // For other kinds we render a labelled placeholder
  return (
    <p
      className={cn(
        'text-[13px] italic',
        outbound ? 'text-emerald-50' : 'text-muted-foreground',
      )}
    >
      {message.body || mediaLabel(message.kind)}
    </p>
  );
}

function mediaLabel(kind: WhatsAppChatMessage['kind']): string {
  switch (kind) {
    case 'image':
      return '📷 Fotoğraf';
    case 'video':
      return '🎬 Video';
    case 'audio':
      return '🎤 Ses mesajı';
    case 'document':
      return '📄 Belge';
    case 'sticker':
      return 'Çıkartma';
    case 'location':
      return '📍 Konum';
    case 'contacts':
      return '👤 Kişi';
    case 'reaction':
      return 'Tepki';
    default:
      return 'Mesaj';
  }
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'queued')
    return <Clock className="size-3" aria-label="Kuyrukta" />;
  if (status === 'sent') return <Check className="size-3" aria-label="Gönderildi" />;
  if (status === 'delivered')
    return <CheckCheck className="size-3" aria-label="Ulaştı" />;
  if (status === 'read')
    return (
      <CheckCheck className="size-3 text-blue-200" aria-label="Okundu" />
    );
  if (status === 'failed')
    return <XCircle className="size-3" aria-label="Başarısız" />;
  return null;
}

function MessagesSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}
        >
          <Skeleton
            className={cn(
              'h-10 rounded-2xl',
              i % 3 === 0 ? 'w-44' : i % 3 === 1 ? 'w-64' : 'w-32',
            )}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-muted-foreground">
        <MessageSquareDashed className="size-8 mx-auto mb-2 opacity-60" />
        <p className="text-sm">Bu sohbette henüz mesaj yok.</p>
        <p className="text-xs mt-1">
          Aşağıdan ilk mesajı göndererek konuşmaya başlayın.
        </p>
      </div>
    </div>
  );
}
