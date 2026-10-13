import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../../stores/auth";

export const api = axios.create({ baseURL: "/api", withCredentials: true });

let refreshPromise: Promise<string> | null = null;

function doRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/v1/auth/refresh/")
      .then((res) => {
        const access = res.data.access as string;
        useAuthStore.getState().setAccessToken(access);
        return access;
      })
      .catch((err) => {
        useAuthStore.getState().clearSession();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    if (status === 401 && original && !original._retried && !url.includes("/v1/auth/refresh")) {
      original._retried = true;
      try {
        const access = await doRefresh();
        original.headers.set("Authorization", `Bearer ${access}`);
        return api(original);
      } catch {
        if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
