import { apiRequest } from '@/lib/api-client';

export type WhatsAppOnboardingMethod = 'manual' | 'embedded_signup';
export type WhatsAppAccountStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface WhatsAppAccount {
  id: number;
  display_name: string;
  phone_e164: string;
  phone_number_id: string;
  business_account_id: string;
  app_id: string;
  api_version: string;
  default_language: string;
  access_token_last4: string;
  app_secret_last4: string;
  onboarding_method: WhatsAppOnboardingMethod;
  status: WhatsAppAccountStatus;
  is_verified_credentials: boolean;
  is_verified_messaging: boolean;
  webhook_subscribed: boolean;
  last_error: string | null;
  last_synced_at: string | null;
  webhook_url: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppAccountCreate {
  display_name: string;
  phone_e164: string;
  phone_number_id: string;
  business_account_id: string;
  app_id: string;
  access_token: string;
  app_secret: string;
  verify_token: string;
  api_version: string;
  default_language: 'tr' | 'en_US';
}

export interface WhatsAppTestResult {
  ok: boolean;
  detail: string | null;
  verified_phone_number?: string | null;
}

export interface WhatsAppSendTestRequest {
  to_phone_e164: string;
  template_name?: string;
  language?: string;
}

export interface WhatsAppSendTestResult {
  ok: boolean;
  message_id?: string | null;
  detail?: string | null;
}

export const whatsappApi = {
  get: () => apiRequest<WhatsAppAccount | null>('/integrations/whatsapp'),
  create: (body: WhatsAppAccountCreate) =>
    apiRequest<WhatsAppAccount>('/integrations/whatsapp', {
      method: 'POST',
      body,
    }),
  test: (id: number) =>
    apiRequest<WhatsAppTestResult>(
      `/integrations/whatsapp/${id}/test`,
      { method: 'POST' },
    ),
  sendTest: (id: number, body: WhatsAppSendTestRequest) =>
    apiRequest<WhatsAppSendTestResult>(
      `/integrations/whatsapp/${id}/send-test`,
      { method: 'POST', body },
    ),
  disconnect: (id: number) =>
    apiRequest<void>(`/integrations/whatsapp/${id}`, { method: 'DELETE' }),
};
