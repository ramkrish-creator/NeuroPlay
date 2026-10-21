import type { DifficultyLevel, GameId, GameSessionResult, UserProfile } from '../types';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'admin' | 'player';
  displayName: string;
  ageGroup: UserProfile['ageGroup'];
  goal: UserProfile['goal'];
  avatarColor: string;
  createdAt?: string;
  mustChangePassword: boolean;
}

export interface AdminUser extends UserProfile {
  username: string;
  role: 'admin' | 'player';
  sessionCount: number;
}

export interface UserData {
  profile: UserProfile;
  sessions: GameSessionResult[];
  difficultyByGame: Record<GameId, DifficultyLevel>;
  recommendedGameIds: GameId[];
}

export interface CreatedUser {
  user: AdminUser;
  temporaryPassword: string;
}

export interface LegacyImportCredential {
  username: string;
  password: string;
  displayName: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function mapUser(user: AuthenticatedUser & { createdAt?: string }): UserProfile {
  return {
    id: user.id,
    name: user.displayName,
    ageGroup: user.ageGroup,
    goal: user.goal,
    createdAt: user.createdAt ?? new Date().toISOString(),
    avatarColor: user.avatarColor,
  };
}

export const api = {
  login: (username: string, password: string) =>
    request<{ user: AuthenticatedUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  currentUser: async () => {
    const result = await request<{ user: AuthenticatedUser }>('/auth/me');
    return result.user;
  },

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  changePassword: (password: string) =>
    request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  loadUserData: async (): Promise<UserData> => {
    const data = await request<Omit<UserData, 'profile'> & { profile: AuthenticatedUser & { createdAt?: string } }>('/me/data');
    return { ...data, profile: mapUser(data.profile) };
  },

  updateProfile: async (profile: UserProfile): Promise<UserData> => {
    const data = await request<Omit<UserData, 'profile'> & { profile: AuthenticatedUser & { createdAt?: string } }>('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: profile.name,
        ageGroup: profile.ageGroup,
        goal: profile.goal,
      }),
    });
    return { ...data, profile: mapUser(data.profile) };
  },

  saveSession: async (session: GameSessionResult, difficultyByGame: Record<GameId, DifficultyLevel>) => {
    const data = await request<Omit<UserData, 'profile'> & { profile: AuthenticatedUser & { createdAt?: string } }>('/me/sessions', {
      method: 'POST',
      body: JSON.stringify({ session, difficultyByGame }),
    });
    return { ...data, profile: mapUser(data.profile) };
  },

  clearSessions: () => request<void>('/me/sessions', { method: 'DELETE' }),

  listUsers: () =>
    request<{ users: (AuthenticatedUser & { createdAt: string; sessionCount: number })[] }>('/admin/users')
      .then(({ users }) => ({
        users: users.map((user) => ({
          ...mapUser(user),
          username: user.username,
          role: user.role,
          sessionCount: user.sessionCount,
        })),
      })),

  createUser: async (details: {
    username: string;
    displayName: string;
    ageGroup: UserProfile['ageGroup'];
    goal: UserProfile['goal'];
  }): Promise<CreatedUser> => {
    const result = await request<{ user: AuthenticatedUser & { createdAt: string }; temporaryPassword: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(details),
    });
    return {
      ...result,
      user: {
        ...mapUser(result.user),
        username: result.user.username,
        role: result.user.role,
        sessionCount: 0,
      },
    };
  },

  resetUserPassword: async (userId: string) => {
    const result = await request<{ username: string; displayName: string; temporaryPassword: string }>(
      `/admin/users/${encodeURIComponent(userId)}/reset-password`,
      {
      method: 'POST',
      },
    );
    return { username: result.username, displayName: result.displayName, password: result.temporaryPassword };
  },

  importLegacyProfiles: (users: unknown[]) =>
    request<{ imported: number; credentials: LegacyImportCredential[] }>('/admin/import-legacy', {
      method: 'POST',
      body: JSON.stringify({ users }),
    }),
};
