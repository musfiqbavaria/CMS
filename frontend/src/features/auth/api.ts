import { api } from "../../shared/api/client";
import { useAuthStore, type SessionUser } from "../../stores/auth";

export interface LoginResult {
  requires_2fa: boolean;
  access?: string;
  user?: SessionUser;
  two_fa_token?: string;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>("/v1/auth/login/", { username, password });
  const store = useAuthStore.getState();
  if (!data.requires_2fa && data.access && data.user) {
    store.setAccessToken(data.access);
    store.setUser(data.user);
  }
  return data;
}

export async function confirmTwoFactorLogin(two_fa_token: string, code: string): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>("/v1/auth/2fa/login/", { two_fa_token, code });
  const store = useAuthStore.getState();
  store.setAccessToken(data.access ?? null);
  if (data.user) store.setUser(data.user);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/v1/auth/logout/");
  } finally {
    useAuthStore.getState().clearSession();
  }
}

/** Silent session restore on app boot: refresh cookie -> access -> profile. */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  try {
    const { data } = await api.post<{ access: string }>("/v1/auth/refresh/");
    store.setAccessToken(data.access);
    const me = await api.get<SessionUser>("/v1/auth/me/");
    store.setUser(me.data);
  } catch {
    store.clearSession();
  }
}

export async function fetchMe(): Promise<SessionUser> {
  const { data } = await api.get<SessionUser>("/v1/auth/me/");
  useAuthStore.getState().setUser(data);
  return data;
}

export function requestPasswordReset(email: string) {
  return api.post("/v1/auth/password-reset/", { email });
}

export function confirmPasswordReset(uid: string, token: string, new_password: string) {
  return api.post("/v1/auth/password-reset/confirm/", { uid, token, new_password });
}
