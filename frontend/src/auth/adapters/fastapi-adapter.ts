import { apiRequest, apiUrl } from '@/lib/api-client';
import { AuthModel, UserModel } from '@/auth/lib/models';

interface BackendUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  avatar_key: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendTokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

const mapUser = (u: BackendUser): UserModel => {
  const [first = '', ...rest] = (u.full_name || '').trim().split(/\s+/);
  const last = rest.join(' ');
  return {
    username: u.username,
    email: u.email,
    first_name: first,
    last_name: last,
    fullname: u.full_name || u.username,
    email_verified: true,
    is_admin: u.role === 'admin',
    roles: [],
    language: 'en',
    pic: u.avatar_url || undefined,
  };
};

export const FastApiAdapter = {
  async login(username: string, password: string): Promise<AuthModel> {
    const form = new URLSearchParams();
    form.set('username', username);
    form.set('password', password);

    const res = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });

    if (!res.ok) {
      let detail = 'Invalid credentials';
      try {
        const data = (await res.json()) as { detail?: string };
        if (data.detail) detail = data.detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    const data = (await res.json()) as BackendTokenPair;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
  },

  async getCurrentUser(): Promise<UserModel | null> {
    try {
      const data = await apiRequest<BackendUser>('/users/me');
      return mapUser(data);
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      const stored = JSON.parse(
        localStorage.getItem(
          `${import.meta.env.VITE_APP_NAME}-auth-v${
            import.meta.env.VITE_APP_VERSION || '1.0'
          }`,
        ) || 'null',
      ) as { refresh_token?: string } | null;

      await apiRequest<void>('/auth/logout', {
        method: 'POST',
        body: stored?.refresh_token
          ? { refresh_token: stored.refresh_token }
          : {},
      });
    } catch {
      // logout is best-effort; client-side cleanup still happens.
    }
  },
};
