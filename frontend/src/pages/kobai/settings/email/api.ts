import { apiRequest } from '@/lib/api-client';

export type EmailProviderCode = 'brevo';
export type EmailProviderStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface EmailProvider {
  id: number;
  provider: EmailProviderCode;
  display_name: string;
  sender_name: string;
  sender_email: string;
  api_key_last4: string;
  is_default: boolean;
  enabled: boolean;
  status: EmailProviderStatus;
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailProviderCreate {
  provider: EmailProviderCode;
  api_key: string;
  sender_name: string;
  sender_email: string;
  display_name?: string;
  enabled?: boolean;
}

export interface EmailProviderTestResult {
  ok: boolean;
  detail: string | null;
}

export interface EmailSendTestRequest {
  to_email: string;
  subject?: string;
}

export interface EmailSendTestResult {
  ok: boolean;
  message_id?: string | null;
  detail?: string | null;
}

export const emailApi = {
  list: () => apiRequest<EmailProvider[]>('/integrations/email'),
  upsert: (body: EmailProviderCreate) =>
    apiRequest<EmailProvider>('/integrations/email', {
      method: 'POST',
      body,
    }),
  test: (id: number) =>
    apiRequest<EmailProviderTestResult>(`/integrations/email/${id}/test`, {
      method: 'POST',
    }),
  sendTest: (id: number, body: EmailSendTestRequest) =>
    apiRequest<EmailSendTestResult>(`/integrations/email/${id}/send-test`, {
      method: 'POST',
      body,
    }),
  disconnect: (id: number) =>
    apiRequest<void>(`/integrations/email/${id}`, { method: 'DELETE' }),
};
