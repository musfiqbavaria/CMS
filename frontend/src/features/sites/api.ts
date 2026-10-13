import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import type { AuditEntry, Paged, Site, SiteFormValues, SiteListParams } from "./types";

export function fetchSites(params: SiteListParams): Promise<Paged<Site>> {
  const q = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.page_size),
  });
  if (params.search) q.set("search", params.search);
  if (params.type) q.set("type", params.type);
  if (params.status) q.set("status", params.status);
  if (params.ordering) q.set("ordering", params.ordering);
  return api.get<Paged<Site>>(`/v1/sites/?${q.toString()}`).then((r) => r.data);
}

export function useSites(params: SiteListParams) {
  return useQuery({ queryKey: ["sites", params], queryFn: () => fetchSites(params), placeholderData: keepPreviousData });
}

export function fetchSite(id: number): Promise<Site> {
  return api.get<Site>(`/v1/sites/${id}/`).then((r) => r.data);
}

export function useSite(id: number | null) {
  return useQuery({
    queryKey: ["site", id],
    queryFn: () => fetchSite(id as number),
    enabled: id !== null,
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SiteFormValues) => api.post<Site>("/v1/sites/", values).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useUpdateSite(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SiteFormValues) => api.patch<Site>(`/v1/sites/${id}/`, values).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["site-logs"] });
    },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/v1/sites/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useSetSiteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.post<Site>(`/v1/sites/${id}/${active ? "activate" : "deactivate"}/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["site-logs"] });
    },
  });
}

export function useBulkSites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { action: "activate" | "deactivate" | "delete"; ids: number[] }) =>
      api.post<{ processed: number; missing: number }>("/v1/sites/bulk/", input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["site-logs"] });
    },
  });
}

export function fetchSiteLogs(siteId: number): Promise<Paged<AuditEntry>> {  return api.get<Paged<AuditEntry>>(`/v1/audit/logs/?site=${siteId}`).then((r) => r.data);
}

export function useSiteLogs(siteId: number | null) {
  return useQuery({
    queryKey: ["site-logs", siteId],
    queryFn: () => fetchSiteLogs(siteId as number),
    enabled: siteId !== null,
  });
}
