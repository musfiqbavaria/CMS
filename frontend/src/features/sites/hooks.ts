import { useEffect, useRef } from "react";
import { useAuthStore } from "../../stores/auth";

export interface ProgressEvent {
  stage: string;
  site_id?: number;
  method?: string;
  detail?: string;
  error?: string;
  snapshot?: Record<string, unknown>;
}

function wsBase(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

/** Live discovery/verification progress for one site. Token passed as query param (JWT). */
export function useSiteProgress(siteId: number | null, onEvent: (e: ProgressEvent) => void) {
  const token = useAuthStore((s) => s.accessToken);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!siteId || !token) return;
    const ws = new WebSocket(`${wsBase()}/ws/sites/${siteId}/progress/?token=${encodeURIComponent(token)}`);
    ws.onmessage = (msg) => {
      try {
        handler.current(JSON.parse(msg.data) as ProgressEvent);
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [siteId, token]);
}
