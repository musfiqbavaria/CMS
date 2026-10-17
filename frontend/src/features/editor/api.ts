import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import type { ConfigVersion, EditorConfig, MediaAsset, SiteConfigDraft } from "./types";
import type { Paged } from "../sites/types";

export function useEditorConfig(siteId: number | null) {
  return useQuery({
    queryKey: ["editor-config", siteId],
    queryFn: () => api.get<EditorConfig>(`/v1/sites/${siteId}/config/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function usePatchDraft(siteId: number) {
  return useMutation({
    mutationFn: (patch: Partial<SiteConfigDraft>) =>
      api.patch<EditorConfig>(`/v1/sites/${siteId}/config/`, patch).then((r) => r.data),
  });
}

export function useSaveDraft(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) =>
      api.post<ConfigVersion>(`/v1/sites/${siteId}/config/save-draft/`, { note }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["editor-config", siteId] });
      qc.invalidateQueries({ queryKey: ["editor-versions", siteId] });
    },
  });
}

export function usePublish(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version_id?: number) =>
      api.post<ConfigVersion>(`/v1/sites/${siteId}/config/publish/`, version_id ? { version_id } : {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-status", siteId] });
      qc.invalidateQueries({ queryKey: ["editor-config", siteId] });
      qc.invalidateQueries({ queryKey: ["editor-versions", siteId] });
    },
  });
}

export function useRollback(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) =>
      api.post<ConfigVersion>(`/v1/sites/${siteId}/config/versions/${versionId}/rollback/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-status", siteId] });
      qc.invalidateQueries({ queryKey: ["editor-config", siteId] });
      qc.invalidateQueries({ queryKey: ["editor-versions", siteId] });
    },
  });
}

export function useResetDraft(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EditorConfig>(`/v1/sites/${siteId}/config/reset-draft/`).then((r) => r.data),
    onSuccess: (cfg) => qc.setQueryData(["editor-config", siteId], cfg),
  });
}

export function useVersions(siteId: number | null) {
  return useQuery({
    queryKey: ["editor-versions", siteId],
    queryFn: () => api.get<Paged<ConfigVersion>>(`/v1/sites/${siteId}/config/versions/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useMedia(siteId: number | null) {
  return useQuery({
    queryKey: ["media", siteId],
    queryFn: () => api.get<Paged<MediaAsset>>(`/v1/media/?site=${siteId}`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: Blob; filename: string; siteId: number; alt: string }) => {
      const form = new FormData();
      form.append("file", input.file, input.filename);
      form.append("site", String(input.siteId));
      form.append("alt", input.alt);
      return api.post<MediaAsset>("/v1/media/", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/v1/media/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}
