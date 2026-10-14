import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import type { Site, SiteDomain } from "./types";

function base(siteId: number) {
  return `/v1/sites/${siteId}/domains/`;
}

export function useSiteDomains(siteId: number | null) {
  return useQuery({
    queryKey: ["site-domains", siteId],
    queryFn: () => api.get<SiteDomain[]>(base(siteId as number)).then((r) => r.data),
    enabled: siteId !== null,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, siteId: number) {
  qc.invalidateQueries({ queryKey: ["site-domains", siteId] });
  qc.invalidateQueries({ queryKey: ["site", siteId] });
  qc.invalidateQueries({ queryKey: ["sites"] });
}

export function useAddDomain(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hostname: string) =>
      api.post<SiteDomain>(base(siteId), { hostname }).then((r) => r.data),
    onSuccess: () => invalidate(qc, siteId),
  });
}

export function useCheckDomain(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<SiteDomain>(`${base(siteId)}${id}/check/`).then((r) => r.data),
    onSuccess: () => invalidate(qc, siteId),
  });
}

export function useMakePrimary(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Site>(`${base(siteId)}${id}/make-primary/`).then((r) => r.data),
    onSuccess: () => invalidate(qc, siteId),
  });
}

export function useDeleteDomain(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`${base(siteId)}${id}/`),
    onSuccess: () => invalidate(qc, siteId),
  });
}
