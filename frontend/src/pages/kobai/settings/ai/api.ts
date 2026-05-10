import { apiRequest } from '@/lib/api-client';

export type AiProviderCode = 'google' | 'openai' | 'anthropic';
export type AiProviderStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface AiProvider {
  id: number;
  provider: AiProviderCode;
  display_name: string;
  model: string;
  max_tokens: number;
  api_key_last4: string;
  is_default: boolean;
  enabled: boolean;
  status: AiProviderStatus;
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiModelInfo {
  id: string;
  name: string;
  provider: AiProviderCode;
  context_window?: number | null;
  max_output_tokens?: number | null;
}

export interface AiModelListResult {
  models: AiModelInfo[];
  source: 'api' | 'static';
}

export interface AiProviderCreate {
  provider: AiProviderCode;
  model: string;
  api_key: string;
  max_tokens?: number;
  display_name?: string;
  enabled?: boolean;
}

export interface AiProviderTestResult {
  ok: boolean;
  detail: string | null;
  sample_text: string | null;
}

export const aiApi = {
  list: () => apiRequest<AiProvider[]>('/integrations/ai'),
  listModels: (provider: AiProviderCode) =>
    apiRequest<AiModelListResult>(
      `/integrations/ai/models?provider=${provider}`,
    ),
  upsert: (body: AiProviderCreate) =>
    apiRequest<AiProvider>('/integrations/ai', {
      method: 'POST',
      body,
    }),
  test: (id: number) =>
    apiRequest<AiProviderTestResult>(`/integrations/ai/${id}/test`, {
      method: 'POST',
    }),
  disconnect: (id: number) =>
    apiRequest<void>(`/integrations/ai/${id}`, { method: 'DELETE' }),
};
