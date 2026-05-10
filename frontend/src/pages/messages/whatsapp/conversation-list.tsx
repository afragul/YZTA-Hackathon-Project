import { useMemo } from 'react';
import { Pin, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  type ConversationStatus,
  type WhatsAppConversation,
} from './api';
import { formatPhone, formatRelativeTime, initials } from './format';

interface Props {
  conversations: WhatsAppConversation[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (conversation: WhatsAppConversation) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: ConversationStatus | 'all';
  onStatusFilterChange: (value: ConversationStatus | 'all') => void;
  unreadTotal: number;
}

const FILTERS: { value: ConversationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'open', label: 'Açık' },
  { value: 'pending', label: 'Bekliyor' },
  { value: 'closed', label: 'Kapalı' },
];

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  unreadTotal,
}: Props) {
  const ordered = useMemo(() => conversations, [conversations]);

  return (
    <aside className="flex flex-col w-[320px] xl:w-[360px] shrink-0 border-e border-input bg-background">
      <div className="px-4 py-3 border-b border-input">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            Sohbetler
            {unreadTotal > 0 && (
              <Badge variant="primary" appearance="light" size="sm">
                {unreadTotal} okunmamış
              </Badge>
            )}
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="İsim veya numara ara..."
            className="ps-8"
          />
        </div>
        <div className="mt-2 flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onStatusFilterChange(f.value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kt-scrollable-y-hover grow">
        {loading && conversations.length === 0 ? (
          <ConversationSkeletons />
        ) : ordered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-input">
            {ordered.map((conv) => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                selected={conv.id === selectedId}
                onClick={() => onSelect(conv)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ConversationRow({
  conversation,
  selected,
  onClick,
}: {
  conversation: WhatsAppConversation;
  selected: boolean;
  onClick: () => void;
}) {
  const name = conversation.contact_name || formatPhone(conversation.wa_id);
  const preview =
    conversation.last_message_text?.trim() || 'Henüz mesaj yok';
  const time = formatRelativeTime(conversation.last_message_at);
  const isOutbound = conversation.last_message_direction === 'outbound';

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-start flex items-start gap-3 px-4 py-3 transition-colors',
          selected ? 'bg-primary/5' : 'hover:bg-muted/60',
        )}
      >
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 grow">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {conversation.is_pinned && (
                <Pin className="size-3 text-muted-foreground shrink-0" />
              )}
              <span className="font-medium truncate text-sm">{name}</span>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {time}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate">
              {isOutbound ? <span className="me-1">Sen:</span> : null}
              {preview}
            </p>
            {conversation.unread_count > 0 ? (
              <span className="text-[10px] font-medium bg-emerald-600 text-white rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center shrink-0">
                {conversation.unread_count > 99
                  ? '99+'
                  : conversation.unread_count}
              </span>
            ) : conversation.status !== 'open' ? (
              <Badge variant="secondary" size="sm" appearance="light">
                {conversation.status === 'closed'
                  ? 'kapalı'
                  : conversation.status === 'pending'
                    ? 'bekliyor'
                    : 'spam'}
              </Badge>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

function ConversationSkeletons() {
  return (
    <ul className="divide-y divide-input">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex gap-3 px-4 py-3">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="grow space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 text-muted-foreground">
      <p className="text-sm">Henüz sohbet yok.</p>
      <p className="text-xs mt-1">
        Müşterileriniz WhatsApp'ta size mesaj attığında burada görünür.
      </p>
    </div>
  );
}
