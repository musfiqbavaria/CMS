import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export function useDiscoverSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/v1/sites/${id}/discover/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}

export function useVerifySite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: number; method: "meta" | "dns" }) =>
      api.post(`/v1/sites/${id}/verify/`, { method }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });
}
