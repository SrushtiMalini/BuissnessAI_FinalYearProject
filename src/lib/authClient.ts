export const AUTH_TOKEN_KEY = 'biq_auth_token';
export const AUTH_RESTAURANT_ID_KEY = 'biq_restaurant_id';

export interface AuthResponse {
  token: string;
  restaurantId: string;
  name: string;
  email: string;
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

export const authClient = {
  signup: (name: string, email: string, password: string) =>
    authRequest('/api/auth/signup', { name, email, password }),
  login: (email: string, password: string) =>
    authRequest('/api/auth/login', { email, password }),
  saveSession: (auth: AuthResponse) => {
    localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
    localStorage.setItem(AUTH_RESTAURANT_ID_KEY, auth.restaurantId);
  },
  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_RESTAURANT_ID_KEY);
  },
  isAuthenticated: () => !!localStorage.getItem(AUTH_TOKEN_KEY),
};
