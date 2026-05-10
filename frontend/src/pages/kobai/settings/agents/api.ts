import { apiRequest } from '@/lib/api-client';

export interface AgentPrompt {
  key: string;
  name: string;
  description: string | null;
  prompt: string;
  enabled: boolean;
  tools: string[];
  is_custom: boolean;
}

export interface AgentPromptUpdate {
  prompt: string;
  enabled?: boolean;
}

export const agentsApi = {
  list: () => apiRequest<AgentPrompt[]>('/integrations/ai/agents'),

  update: (key: string, body: AgentPromptUpdate) =>
    apiRequest<AgentPrompt>(`/integrations/ai/agents/${key}`, {
      method: 'PATCH',
      body,
    }),
};
