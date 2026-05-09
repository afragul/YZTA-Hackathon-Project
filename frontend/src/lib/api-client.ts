import { getAuth, removeAuth, setAuth } from '@/auth/lib/helpers';
import { AuthModel } from '@/auth/lib/models';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api/v1';

export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${API_PREFIX}${path}`;

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  raw?: boolean;
}

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function refreshAccessToken(): Promise<AuthModel | null> {
  const current = getAuth();
  if (!current?.refresh_token) return null;

  try {
    const res = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string };
    const updated: AuthModel = {
      access_token: data.access_token,
      refresh_token: current.refresh_token,
    };
    setAuth(updated);
    return updated;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, raw = false, headers, ...rest } = options;

  const buildHeaders = (token?: string): HeadersInit => {
    const h = new Headers(headers || {});
    if (!raw && body !== undefined) {
      h.set('Content-Type', 'application/json');
    }
    h.set('Accept', 'application/json');
    if (auth && token) {
      h.set('Authorization', `Bearer ${token}`);
    }
    return h;
  };

  const send = async (token?: string): Promise<Response> => {
    return fetch(apiUrl(path), {
      ...rest,
      headers: buildHeaders(token),
      body: raw
        ? (body as BodyInit | null | undefined)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  };

  let token = auth ? getAuth()?.access_token : undefined;
  let response = await send(token);

  if (response.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed.access_token;
      response = await send(token);
    } else {
      removeAuth();
    }
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text().catch(() => null);
    }
    const detail =
      (payload as { detail?: string } | null)?.detail ||
      `Request failed with status ${response.status}`;
    throw new ApiError(detail, response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export { ApiError };
