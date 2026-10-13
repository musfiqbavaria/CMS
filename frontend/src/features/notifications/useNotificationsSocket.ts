import { useEffect } from "react";
import { api } from "../../shared/api/client";
import { useAuthStore } from "../../stores/auth";
import { useNotificationsStore } from "../../stores/notifications";

export interface LiveNotification {
  id: number;
  kind: string;
  title: string;
  detail?: string;
  created_at: string;
}

function wsBase(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

/** Load unread notifications, then stay subscribed for live pushes. */
export function useNotificationsSocket() {
  const status = useAuthStore((s) => s.status);
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    api
      .get<{ results: LiveNotification[] }>("/v1/monitoring/notifications/?read=false&page_size=50")
      .then((r) => {
        if (!cancelled) {
          useNotificationsStore.getState().setItems(
            r.data.results.map((n) => ({
              id: String(n.id),
              title: n.title,
              createdAt: n.created_at,
              read: false,
            })),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    function connect() {
      const liveToken = useAuthStore.getState().accessToken;
      if (closed || !liveToken || useAuthStore.getState().status !== "authenticated") return;
      const ws = new WebSocket(`${wsBase()}/ws/notifications/?token=${encodeURIComponent(liveToken)}`);
      ws.onmessage = (msg) => {
        try {
          const e = JSON.parse(msg.data) as { stage?: string; title?: string };
          if (e.stage) return; // hello frame
          if (e.title) {
            useNotificationsStore.getState().push({ title: e.title });
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (closed) return;
        attempts += 1;
        if (attempts > 5) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempts, 15000));
      };
    }
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, token]);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/v1/monitoring/notifications/mark-all-read/");
  useNotificationsStore.getState().markAllRead();
}
