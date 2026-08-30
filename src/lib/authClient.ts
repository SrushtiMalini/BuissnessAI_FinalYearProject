export const AUTH_TOKEN_KEY = 'biq_auth_token'; // short-lived access token (JWT)
export const AUTH_REFRESH_TOKEN_KEY = 'biq_refresh_token'; // long-lived rotating refresh token
export const AUTH_RESTAURANT_ID_KEY = 'biq_restaurant_id';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  restaurantId: string;
  name: string;
  email: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  restaurantId: string;
}

async function authRequest(endpoint: '/api/auth/signup' | '/api/auth/login', payload: Record<string, string>): Promise<AuthResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as AuthResponse;
}

// Ensures only one refresh request is ever in flight — if several requests
// 401 at once (e.g. parallel hydrate() calls), every caller awaits the same
// promise instead of racing separate refresh calls that would each rotate
// (and invalidate) the refresh token the others are relying on.
let refreshInFlight: Promise<string | null> | null = null;

export const authClient = {
  signup: (name: string, email: string, password: string) =>
    authRequest('/api/auth/signup', { name, email, password }),
  login: (email: string, password: string) =>
    authRequest('/api/auth/login', { email, password }),
  saveSession: (auth: AuthResponse) => {
    localStorage.setItem(AUTH_TOKEN_KEY, auth.accessToken);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, auth.refreshToken);
    localStorage.setItem(AUTH_RESTAURANT_ID_KEY, auth.restaurantId);
  },
  /** Clears local session state only — does not call the server. Used as the fallback when a refresh attempt itself fails. */
  clearSession: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_RESTAURANT_ID_KEY);
  },
  /** Revokes the refresh token server-side, then clears local session state. Best-effort: local state is cleared even if the network call fails. */
  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_RESTAURANT_ID_KEY);
    if (!refreshToken) return;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Session is already cleared client-side either way.
    }
  },
  isAuthenticated: () => !!localStorage.getItem(AUTH_TOKEN_KEY),
  /**
   * Exchanges the stored refresh token for a new access+refresh pair (rotation).
   * Returns the new access token, or null if there was no refresh token to use
   * or the server rejected it (expired/revoked) — callers should treat null as
   * "the session is over," not retry.
   */
  refreshAccessToken: async (): Promise<string | null> => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = await res.json() as RefreshResponse;
        localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
        localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      }
    })();
    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  },
};
