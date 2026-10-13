import { create } from "zustand";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_2fa_enabled: boolean;
}

type Status = "loading" | "authenticated" | "anonymous";

interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;
  status: Status;
  setAccessToken: (token: string | null) => void;
  setUser: (user: SessionUser | null) => void;
  setStatus: (status: Status) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null, // access token lives only in memory, never in storage
  user: null,
  status: "loading",
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user, status: user ? "authenticated" : "anonymous" }),
  setStatus: (status) => set({ status }),
  clearSession: () => set({ accessToken: null, user: null, status: "anonymous" }),
}));
