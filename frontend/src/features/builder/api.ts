import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import type { Category, Menu, MenuItem, Page, Post, Product, Section, Tag, Theme } from "./types";
import type { Site } from "../sites/types";

function base(siteId: number) {
  return `/v1/sites/${siteId}/builder`;
}

export function useBuiltSites() {
  return useQuery({
    queryKey: ["sites-built"],
    queryFn: () => api.get<{ results: Site[] }>(`/v1/sites/?type=built&page_size=100`).then((r) => r.data.results),
  });
}

// ---- pages & sections ----
export function usePages(siteId: number | null) {
  return useQuery({
    queryKey: ["pages", siteId],
    queryFn: () => api.get<Page[]>(`${base(siteId as number)}/pages/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function usePage(siteId: number | null, pageId: number | null) {
  return useQuery({
    queryKey: ["page", siteId, pageId],
    queryFn: () => api.get<Page>(`${base(siteId as number)}/pages/${pageId}/`).then((r) => r.data),
    enabled: siteId !== null && pageId !== null,
  });
}

export function useCreatePage(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; status?: string }) =>
      api.post<Page>(`${base(siteId)}/pages/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", siteId] }),
  });
}

export function useUpdatePage(siteId: number, pageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Page>) => api.patch<Page>(`${base(siteId)}/pages/${pageId}/`, input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", siteId] });
      qc.invalidateQueries({ queryKey: ["page", siteId, pageId] });
    },
  });
}

export function useDeletePage(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pageId: number) => api.delete(`${base(siteId)}/pages/${pageId}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", siteId] }),
  });
}

export function useSections(siteId: number | null, pageId: number | null) {
  return useQuery({
    queryKey: ["sections", siteId, pageId],
    queryFn: () => api.get<Section[]>(`${base(siteId as number)}/pages/${pageId}/sections/`).then((r) => r.data),
    enabled: siteId !== null && pageId !== null,
  });
}

export function useAddSection(siteId: number, pageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string }) => api.post<Section>(`${base(siteId)}/pages/${pageId}/sections/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", siteId, pageId] }),
  });
}

export function usePatchSection(siteId: number, pageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<Section>) =>
      api.patch<Section>(`${base(siteId)}/sections/${id}/`, patch).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", siteId, pageId] }),
  });
}

export function useDeleteSection(siteId: number, pageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`${base(siteId)}/sections/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", siteId, pageId] }),
  });
}

export function useReorderSections(siteId: number, pageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<Section[]>(`${base(siteId)}/pages/${pageId}/sections/reorder/`, { ids }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", siteId, pageId] }),
  });
}

export function useAllSections(siteId: number | null) {
  const pages = usePages(siteId);
  return useQuery({
    queryKey: ["all-sections", siteId, pages.data?.map((p) => p.id).join(",")],
    queryFn: async () => {
      const out: (Section & { page_title: string })[] = [];
      for (const p of pages.data ?? []) {
        const secs = await api.get<Section[]>(`${base(siteId as number)}/pages/${p.id}/sections/`).then((r) => r.data);
        secs.forEach((s) => out.push({ ...s, page_title: p.title }));
      }
      return out;
    },
    enabled: !!pages.data,
  });
}

// ---- posts ----
export function usePosts(siteId: number | null) {
  return useQuery({
    queryKey: ["posts", siteId],
    queryFn: () => api.get<Post[]>(`${base(siteId as number)}/posts/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useCreatePost(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Post>(`${base(siteId)}/posts/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts", siteId] }),
  });
}

export function useUpdatePost(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Record<string, unknown>) =>
      api.patch<Post>(`${base(siteId)}/posts/${id}/`, patch).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts", siteId] }),
  });
}

export function useDeletePost(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`${base(siteId)}/posts/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts", siteId] }),
  });
}

export function usePostTaxonomy(siteId: number | null) {
  const cats = useQuery({
    queryKey: ["post-cats", siteId],
    queryFn: () => api.get<Category[]>(`${base(siteId as number)}/post-categories/`).then((r) => r.data),
    enabled: siteId !== null,
  });
  const tags = useQuery({
    queryKey: ["tags", siteId],
    queryFn: () => api.get<Tag[]>(`${base(siteId as number)}/tags/`).then((r) => r.data),
    enabled: siteId !== null,
  });
  return { cats, tags };
}

export function useCreateCategory(siteId: number, kind: "post-categories" | "product-categories" | "tags") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.post<Category>(`${base(siteId)}/${kind}/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ---- menus ----
export function useMenus(siteId: number | null) {
  return useQuery({
    queryKey: ["menus", siteId],
    queryFn: () => api.get<Menu[]>(`${base(siteId as number)}/menus/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useCreateMenu(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.post<Menu>(`${base(siteId)}/menus/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus", siteId] }),
  });
}

export function useMenuItems(siteId: number | null, menuId: number | null) {
  return useQuery({
    queryKey: ["menu-items", siteId, menuId],
    queryFn: () => api.get<MenuItem[]>(`${base(siteId as number)}/menus/${menuId}/items/`).then((r) => r.data),
    enabled: siteId !== null && menuId !== null,
  });
}

export function useMenuItemMutations(siteId: number, menuId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["menu-items", siteId, menuId] });
    qc.invalidateQueries({ queryKey: ["menus", siteId] });
  };
  const add = useMutation({
    mutationFn: (input: { label: string; url: string }) =>
      api.post<MenuItem>(`${base(siteId)}/menus/${menuId}/items/`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const patch = useMutation({
    mutationFn: ({ id, ...p }: { id: number } & Partial<MenuItem>) =>
      api.patch<MenuItem>(`${base(siteId)}/menus/${menuId}/items/${id}/`, p).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`${base(siteId)}/menus/${menuId}/items/${id}/`),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) =>
      api.post<MenuItem[]>(`${base(siteId)}/menus/${menuId}/items/reorder/`, { ids }).then((r) => r.data),
    onSuccess: invalidate,
  });
  return { add, patch, remove, reorder };
}

// ---- products ----
export function useProducts(siteId: number | null) {
  return useQuery({
    queryKey: ["products", siteId],
    queryFn: () => api.get<Product[]>(`${base(siteId as number)}/products/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useCreateProduct(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Product>(`${base(siteId)}/products/`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", siteId] }),
  });
}

export function useUpdateProduct(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Record<string, unknown>) =>
      api.patch<Product>(`${base(siteId)}/products/${id}/`, patch).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", siteId] }),
  });
}

export function useDeleteProduct(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`${base(siteId)}/products/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", siteId] }),
  });
}

export function useProductCategories(siteId: number | null) {
  return useQuery({
    queryKey: ["product-cats", siteId],
    queryFn: () => api.get<Category[]>(`${base(siteId as number)}/product-categories/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

// ---- themes ----
export function useThemes() {
  return useQuery({
    queryKey: ["themes"],
    queryFn: () => api.get<Theme[]>("/v1/builder/themes/").then((r) => r.data),
  });
}

export function useSiteTheme(siteId: number | null) {
  return useQuery({
    queryKey: ["site-theme", siteId],
    queryFn: () =>
      api.get<{ theme: number | null; theme_name: string | null }>(`${base(siteId as number)}/theme/`).then((r) => r.data),
    enabled: siteId !== null,
  });
}

export function useAssignTheme(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (theme: number) => api.post(`${base(siteId)}/theme/`, { theme }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-theme", siteId] }),
  });
}
