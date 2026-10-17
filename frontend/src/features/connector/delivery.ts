import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export interface DeliveryReport {
  id: number;
  version: number | null;
  revision: string;
  state: "ready" | "partial" | "error";
  context: "live" | "preview";
  page_path: string;
  applied: string[];
  unmatched: { key: string; selector: string }[];
  errors: { key: string; message: string }[];
  started_at: string;
  received_at: string;
}

export interface DeliveryStatus {
  state: "unsupported" | "inactive" | "unverified" | "unpublished" | "waiting" | "error" | "outdated" | "changed" | "partial" | "stale" | "reported";
  message: string;
  published_version: number | null;
  version_created_at: string | null;
  expected_revision: string | null;
  latest_report: DeliveryReport | null;
  latest_preview: DeliveryReport | null;
  recent_reports: DeliveryReport[];
  field_labels: Record<string, string>;
  fresh_for_seconds: number;
  checked_at: string;
}

export function useDeliveryStatus(siteId: number | null) {
  return useQuery({
    queryKey: ["delivery-status", siteId],
    queryFn: () => api.get<DeliveryStatus>(`/v1/sites/${siteId}/delivery/`).then((r) => r.data),
    enabled: siteId !== null,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
