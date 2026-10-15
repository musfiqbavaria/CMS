import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../shared/api/client";
import MediaPage from "./MediaPage";

vi.mock("../../../shared/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const asset = { id: 1, site: null, file: "media/landscape.png", url: "/media/landscape.png", alt: "Studio landscape", width: 640, height: 480, size: 1024, uploaded_by: 1, created_at: "2026-10-15T00:00:00Z" };
const clients: QueryClient[] = [];
const library = (results = [asset], count = results.length, next: string | null = null) => ({ data: { results, count, next, previous: null } });

function renderLibrary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><MediaPage /></QueryClientProvider>);
  return client;
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.restoreAllMocks(); });

describe("MediaPage", () => {
  it("loads the next server page without leaving the media library", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(library([asset], 25, "/api/v1/media/?page=2"))
      .mockResolvedValueOnce(library([{ ...asset, id: 2, alt: "Brand illustration" }], 25));
    renderLibrary();
    await screen.findByText("Studio landscape");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Brand illustration")).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith("/v1/media/?page_size=24&page=2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("uploads the selected file with its description and refreshes both media queries", async () => {
    vi.mocked(api.get).mockResolvedValue(library([]));
    vi.mocked(api.post).mockResolvedValue({ data: asset });
    const client = renderLibrary();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByText("Room for your first image");
    fireEvent.change(screen.getByLabelText(/Describe the image/), { target: { value: "A calm studio landscape" } });
    const file = new File(["image"], "landscape.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload an image"), { target: { files: [file] } });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["media"] }));
    expect(api.post).toHaveBeenCalledWith("/v1/media/", expect.any(FormData));
    const form = vi.mocked(api.post).mock.calls[0][1] as FormData;
    expect(form.get("file")).toEqual(file);
    expect(form.get("alt")).toBe("A calm studio landscape");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["media-all"] });
    expect(screen.getByLabelText(/Describe the image/)).toHaveValue("");
  });

  it("respects deletion cancellation and reports a failed deletion without losing the image", async () => {
    vi.mocked(api.get).mockResolvedValue(library());
    vi.mocked(api.delete).mockRejectedValue(new Error("Unavailable"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderLibrary();
    const remove = await screen.findByRole("button", { name: "Delete Studio landscape" });
    fireEvent.click(remove);
    expect(api.delete).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(remove);
    expect(await screen.findByRole("alert")).toHaveTextContent("The image couldn't be deleted.");
    expect(api.delete).toHaveBeenCalledWith("/v1/media/1/");
    expect(screen.getByText("Studio landscape")).toBeInTheDocument();
  });

  it("offers a retry after a failed library request", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(library([]));
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Room for your first image")).toBeInTheDocument();
  });
});
