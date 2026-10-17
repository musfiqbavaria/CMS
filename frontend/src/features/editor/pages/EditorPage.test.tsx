import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../shared/api/client";
import type { EditorConfig, SiteConfigDraft } from "../types";
import EditorPage from "./EditorPage";

vi.mock("../../../shared/api/client", () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));

const draft: SiteConfigDraft = {
  general: { site_name: "Acme", tagline: "Made with care" },
  header: { logo_url: "", layout: "left", sticky: true, cta_text: "", cta_url: "" },
  footer: { columns: [], copyright: "Acme", show_newsletter: false },
  branding: { logo_url: "", favicon_url: "" },
  cover: { image_url: "", overlay_opacity: 0.4 },
  hero: { eyebrow: "", heading: "Welcome", subheading: "Hello", background_image: "", alignment: "center", overlay_opacity: 0.5, buttons: [] },
  navigation: { items: [] },
  theme: { colors: { primary: "#111111", secondary: "#222222", background: "#ffffff", text: "#000000" }, typography: { heading_font: "system-ui", body_font: "system-ui", base_size: 16 } },
  seo: { title: "Acme", description: "", keywords: "", og_image: "" },
  custom: { css: "", js: "" },
  social: { facebook: "", x: "", instagram: "", linkedin: "", youtube: "" },
};

let config: EditorConfig;
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  config = { id: 11, site: 1, draft: structuredClone(draft), published: draft, published_version: 3, published_version_no: 3, updated_at: "2026-10-15T00:00:00Z" };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url).includes("/config/versions/")) return { data: { count: 0, results: [] } };
    if (String(url).endsWith("/config/")) return { data: config };
    if (String(url).includes("/media/")) return { data: { count: 0, results: [] } };
    return { data: { id: 1, name: "Acme", domain: "acme.example", public_url: "https://acme.example", connector_origin: "http://localhost:8080", discovery: { title: "Acme" } } };
  });
  vi.mocked(api.patch).mockImplementation(async (_url, patch) => {
    config = { ...config, draft: patch as SiteConfigDraft };
    return { data: config };
  });
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (String(url).endsWith("/publish/")) config = { ...config, published: config.draft, published_version: 4, published_version_no: 4 };
    return { data: { id: 4, version_no: 4 } };
  });
});

afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.restoreAllMocks(); });

async function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const router = createMemoryRouter([{ path: "/websites/:id/edit", element: <EditorPage /> }], { initialEntries: ["/websites/1/edit"] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await screen.findByLabelText("Site name");
}

describe("connected website editor workspace", () => {
  it("opens and focuses a clicked preview field without losing draft edits or publishing", async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "Unsaved brand" } });
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/ }));
    const frame = screen.getByTitle("Draft preview") as HTMLIFrameElement;
    const content = new DOMParser().parseFromString(frame.getAttribute("srcdoc")!, "text/html");
    const channel = JSON.parse(content.querySelector("[data-cms-editor-config]")!.getAttribute("data-cms-editor-config")!).channel;
    fireEvent(window, new MessageEvent("message", { origin: "null", source: frame.contentWindow, data: { type: "cms:editor:select", channel, key: "hero_heading" } }));
    expect(screen.getByLabelText("Heading")).toHaveValue("Welcome");
    expect(screen.getByLabelText("Heading")).toHaveFocus();
    expect(screen.getByTitle("Draft preview")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Choose an editor section"), { target: { value: "general" } });
    expect(screen.getByLabelText("Site name")).toHaveValue("Unsaved brand");
  });
  it("keeps in-progress edits when switching sections and workspace views", async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "Acme Studio" } });
    fireEvent.change(screen.getByLabelText("Choose an editor section"), { target: { value: "hero" } });
    expect(screen.getByLabelText("Heading")).toHaveValue("Welcome");
    fireEvent.change(screen.getByLabelText("Choose an editor section"), { target: { value: "general" } });
    expect(screen.getByLabelText("Site name")).toHaveValue("Acme Studio");
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/ }));
    expect(screen.queryByLabelText("Site name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to editing" }));
    expect(screen.getByLabelText("Site name")).toHaveValue("Acme Studio");
    expect(screen.queryByTitle("Draft preview")).not.toBeInTheDocument();
  });

  it("saves a named checkpoint with the latest form values", async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "Acme Studio" } });
    fireEvent.change(screen.getByLabelText(/Version note/), { target: { value: "Brand refresh" } });
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    expect(await screen.findByText("Draft saved as v4.")).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith("/v1/sites/1/config/", expect.objectContaining({ general: { site_name: "Acme Studio", tagline: "Made with care" } }));
    expect(api.post).toHaveBeenCalledWith("/v1/sites/1/config/save-draft/", { note: "Brand refresh" });
    expect(screen.getByLabelText(/Version note/)).toHaveValue("");
  });

  it("respects publish cancellation and flushes the latest draft before publishing", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "Acme Studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }));
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/sites/1/config/publish/", {}));
    expect(vi.mocked(api.patch).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.post).mock.invocationCallOrder[0]);
    expect(await screen.findByText(/Published v4\. Reload the connected website/)).toHaveTextContent("Your CMS is local");
    expect(screen.getByLabelText("Site name")).toHaveValue("Acme Studio");
  });

  it("persists removing a page text area even though the form returns to its loaded values", async () => {
    config = {
      ...config,
      draft: {
        ...structuredClone(draft),
        pages: { blocks: [{ id: "b0123456789abcdef", path: "/jobs", label: "Jobs heading", selector: "h1.display-6", text: "Find your next opportunity" }] },
      },
    };
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Choose an editor section"), { target: { value: "advanced" } });
    expect(screen.getByText("Jobs heading")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/v1/sites/1/config/", expect.objectContaining({ pages: { blocks: [] } })));
    expect(screen.queryByText("Jobs heading")).not.toBeInTheDocument();
  });
});
