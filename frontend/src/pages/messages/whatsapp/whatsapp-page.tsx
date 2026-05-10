import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import {
  whatsappApi,
  type WhatsAppAccount,
} from '@/pages/kobai/settings/whatsapp/api';
import {
  whatsappChatApi,
  type ConversationStatus,
  type WhatsAppChatMessage,
  type WhatsAppConversation,
} from './api';
import { ChatPanel } from './chat-panel';
import { ConversationList } from './conversation-list';
import { NewChatDialog } from './new-chat-dialog';

const POLL_INTERVAL_MS = 5_000;

export function WhatsAppMessagesPage() {
  const [account, setAccount] = useState<WhatsAppAccount | null>(null);
  const [accountChecking, setAccountChecking] = useState(true);

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>(
    'all',
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<WhatsAppChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  // Debounce search input → params
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  const fetchAccount = useCallback(async () => {
    setAccountChecking(true);
    try {
      const acc = await whatsappApi.get();
      setAccount(acc);
    } catch {
      setAccount(null);
    } finally {
      setAccountChecking(false);
    }
  }, []);

  const fetchConversations = useCallback(
    async (silent = false) => {
      if (!silent) {
        setConversationsLoading(true);
        setConversationsError(null);
      }
      try {
        const res = await whatsappChatApi.listConversations({
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchDebounced || undefined,
          limit: 100,
        });
        setConversations(res.data);
        setUnreadTotal(res.unread_total);
      } catch (e) {
        if (!silent) {
          setConversationsError(
            e instanceof ApiError ? e.message : 'Sohbetler yüklenemedi.',
          );
        }
      } finally {
        if (!silent) setConversationsLoading(false);
      }
    },
    [searchDebounced, statusFilter],
  );

  const fetchMessages = useCallback(
    async (conversationId: number, silent = false) => {
      if (!silent) setMessagesLoading(true);
      try {
        const res = await whatsappChatApi.listMessages(conversationId, 1, 200);
        setMessages(res.data);
      } catch (e) {
        if (!silent) {
          setSendError(
            e instanceof ApiError ? e.message : 'Mesajlar yüklenemedi.',
          );
        }
      } finally {
        if (!silent) setMessagesLoading(false);
      }
    },
    [],
  );

  // Initial load
  useEffect(() => {
    void fetchAccount();
  }, [fetchAccount]);

  useEffect(() => {
    if (!account) return;
    void fetchConversations();
  }, [account, fetchConversations]);

  // Poll conversations + selected messages
  const pollerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!account) return;
    if (pollerRef.current) {
      window.clearInterval(pollerRef.current);
    }
    pollerRef.current = window.setInterval(() => {
      void fetchConversations(true);
      if (selectedId) void fetchMessages(selectedId, true);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };
  }, [account, fetchConversations, fetchMessages, selectedId]);

  // Handle selection: load messages and mark read
  const handleSelect = useCallback(
    async (conv: WhatsAppConversation) => {
      setSelectedId(conv.id);
      setSendError(null);
      setMessages([]);
      await fetchMessages(conv.id);
      if (conv.unread_count > 0) {
        try {
          await whatsappChatApi.markRead(conv.id);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conv.id ? { ...c, unread_count: 0 } : c,
            ),
          );
          setUnreadTotal((prev) => Math.max(0, prev - conv.unread_count));
        } catch {
          // non-fatal
        }
      }
    },
    [fetchMessages],
  );

  const handleSend = useCallback(
    async (body: string) => {
      if (!selectedId) return;
      setSending(true);
      setSendError(null);
      try {
        const msg = await whatsappChatApi.sendText(selectedId, body);
        setMessages((prev) => [...prev, msg]);
        // Optimistic conversation refresh
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? {
                  ...c,
                  last_message_text: body,
                  last_message_at: msg.created_at,
                  last_message_direction: 'outbound',
                  unread_count: 0,
                }
              : c,
          ),
        );
      } catch (e) {
        setSendError(
          e instanceof ApiError
            ? typeof e.data === 'object' && e.data
              ? (e.data as { detail?: string }).detail || e.message
              : e.message
            : 'Gönderim sırasında bir hata oluştu.',
        );
      } finally {
        setSending(false);
      }
    },
    [selectedId],
  );

  const handleChangeStatus = useCallback(
    async (newStatus: ConversationStatus) => {
      if (!selectedId) return;
      try {
        const updated = await whatsappChatApi.updateStatus(
          selectedId,
          newStatus,
        );
        setConversations((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      } catch (e) {
        setSendError(
          e instanceof ApiError ? e.message : 'Durum güncellenemedi.',
        );
      }
    },
    [selectedId],
  );

  const handleNewChatCreated = useCallback(
    (conv: WhatsAppConversation) => {
      setConversations((prev) => {
        const without = prev.filter((c) => c.id !== conv.id);
        return [conv, ...without];
      });
      void handleSelect(conv);
    },
    [handleSelect],
  );

  if (accountChecking) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="px-6 py-10">
        <Helmet>
          <title>WhatsApp | Kobai</title>
        </Helmet>
        <div className="max-w-xl mx-auto rounded-lg border border-input bg-background p-6 text-center">
          <MessageCircle className="size-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-lg font-semibold">WhatsApp henüz bağlı değil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Müşteri sohbetlerini buradan yönetebilmek için önce WhatsApp
            Business hesabınızı bağlayın.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button asChild>
              <Link to="/settings/integrations">Entegrasyonu Aç</Link>
            </Button>
            <Button variant="outline" onClick={() => void fetchAccount()}>
              <RefreshCw className="size-4 me-1" />
              Yenile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex grow min-h-0 min-w-0">
      <Helmet>
        <title>WhatsApp | Kobai</title>
      </Helmet>

      <ConversationList
        conversations={conversations}
        loading={conversationsLoading}
        selectedId={selectedId}
        onSelect={(c) => void handleSelect(c)}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        unreadTotal={unreadTotal}
      />

      <div className="flex grow min-w-0 flex-col">
        {conversationsError && (
          <div className="border-b border-destructive/30 bg-destructive/5 text-destructive text-xs px-4 py-2 flex items-start gap-2">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            <span>{conversationsError}</span>
          </div>
        )}

        <div className="hidden lg:flex items-center justify-end gap-2 px-4 py-2 border-b border-input bg-background/60">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchConversations()}
          >
            <RefreshCw className="size-3.5 me-1" />
            Yenile
          </Button>
          <Button size="sm" onClick={() => setNewChatOpen(true)}>
            <Plus className="size-3.5 me-1" />
            Yeni Sohbet
          </Button>
        </div>

        <ChatPanel
          conversation={selectedConversation}
          messages={messages}
          loadingMessages={messagesLoading}
          sending={sending}
          sendError={sendError}
          onSend={handleSend}
          onChangeStatus={handleChangeStatus}
        />
      </div>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onCreated={(c) => {
          setNewChatOpen(false);
          handleNewChatCreated(c);
        }}
      />
    </div>
  );
}
