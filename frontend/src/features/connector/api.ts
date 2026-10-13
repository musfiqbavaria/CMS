import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export interface SelectorMapping {
  id: number;
  site: number;
  key: string;
  key_label: string;
  selector: string;
  enabled: boolean;
}

export function useMappings(siteId: number | null) {
  return useQuery({
    queryKey: ["mappings", siteId],
    queryFn: () => api.get<SelectorMapping[]>(`/v1/sites/${siteId}/mappings/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useCreateMapping(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; selector: string }) =>
      api.post<SelectorMapping>(`/v1/sites/${siteId}/mappings/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mappings", siteId] }),
  });
}

export function useUpdateMapping(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number; selector?: string; enabled?: boolean }) =>
      api.patch<SelectorMapping>(`/v1/sites/${siteId}/mappings/${id}/`, patch).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mappings", siteId] }),
  });
}

export function useDeleteMapping(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/v1/sites/${siteId}/mappings/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mappings", siteId] }),
  });
}

export function useResetMappings(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SelectorMapping[]>(`/v1/sites/${siteId}/mappings/reset-defaults/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mappings", siteId] }),
  });
}
