import { api } from "../../shared/api/client";
import type { SessionUser } from "../../stores/auth";

export interface TwoFactorSetup {
  enabled: boolean;
  secret?: string;
  otpauth_url?: string;
}

export function updateMe(input: { first_name?: string; last_name?: string; email?: string }) {
  return api.patch<SessionUser>("/v1/auth/me/", input).then((r) => r.data);
}

export function changePassword(old_password: string, new_password: string) {
  return api.post("/v1/auth/password/change/", { old_password, new_password });
}

export function fetchTwoFactorSetup() {
  return api.get<TwoFactorSetup>("/v1/auth/2fa/setup/").then((r) => r.data);
}

export function confirmTwoFactorSetup(code: string) {
  return api.post<TwoFactorSetup>("/v1/auth/2fa/setup/", { code }).then((r) => r.data);
}

export function disableTwoFactor(password: string) {
  return api.post("/v1/auth/2fa/disable/", { password });
}
