import { apiRequest } from '@/lib/api-client';

export type ConversationStatus = 'open' | 'pending' | 'closed' | 'spam';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'reaction'
  | 'system'
  | 'other';
export type MessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'received';

export interface WhatsAppConversation {
  id: number;
  account_id: number;
  wa_id: string;
  contact_name: string | null;
  contact_profile_pic_url: string | null;
  status: ConversationStatus;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_direction: MessageDirection | null;
  is_pinned: boolean;
  ai_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppChatMessage {
  id: number;
  conversation_id: number;
  wamid: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  status: MessageStatus;
  body: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  error_message: string | null;
  sent_by_user_id: number | null;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationListResponse {
  data: WhatsAppConversation[];
  total: number;
  unread_total: number;
}

export interface MessageListResponse {
  data: WhatsAppChatMessage[];
  total: number;
}

export interface ConversationStats {
  total: number;
  open: number;
  pending: number;
  closed: number;
  unread: number;
}

export interface ListConversationsParams {
  status?: ConversationStatus;
  search?: string;
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      usp.set(k, String(v));
    }
  });
  const q = usp.toString();
  return q ? `?${q}` : '';
}

export const whatsappChatApi = {
  listConversations: (params: ListConversationsParams = {}) =>
    apiRequest<ConversationListResponse>(
      `/whatsapp/chat/conversations${buildQuery({ ...params })}`,
    ),
  getConversation: (id: number) =>
    apiRequest<WhatsAppConversation>(`/whatsapp/chat/conversations/${id}`),
  listMessages: (id: number, page = 1, limit = 100) =>
    apiRequest<MessageListResponse>(
      `/whatsapp/chat/conversations/${id}/messages${buildQuery({ page, limit })}`,
    ),
  sendText: (id: number, body: string) =>
    apiRequest<WhatsAppChatMessage>(
      `/whatsapp/chat/conversations/${id}/messages`,
      { method: 'POST', body: { body } },
    ),
  startConversation: (input: {
    to_phone_e164: string;
    body: string;
    contact_name?: string | null;
  }) =>
    apiRequest<WhatsAppConversation>('/whatsapp/chat/conversations', {
      method: 'POST',
      body: input,
    }),
  updateStatus: (id: number, status: ConversationStatus) =>
    apiRequest<WhatsAppConversation>(
      `/whatsapp/chat/conversations/${id}/status`,
      { method: 'PATCH', body: { status } },
    ),
  markRead: (id: number) =>
    apiRequest<WhatsAppConversation>(
      `/whatsapp/chat/conversations/${id}/read`,
      { method: 'PATCH' },
    ),
  toggleAi: (id: number, ai_enabled: boolean) =>
    apiRequest<WhatsAppConversation>(
      `/whatsapp/chat/conversations/${id}/ai-toggle`,
      { method: 'PATCH', body: { ai_enabled } },
    ),
  delete: (id: number) =>
    apiRequest<void>(`/whatsapp/chat/conversations/${id}`, {
      method: 'DELETE',
    }),
  stats: () =>
    apiRequest<ConversationStats>('/whatsapp/chat/stats'),
};
