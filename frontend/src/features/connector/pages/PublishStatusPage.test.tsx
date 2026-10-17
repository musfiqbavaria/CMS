import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../shared/api/client";
import type { DeliveryReport, DeliveryStatus } from "../delivery";
import PublishStatusPage from "./PublishStatusPage";

vi.mock("../../../shared/api/client", () => ({ api: { get: vi.fn() } }));

const report: DeliveryReport = {
  id: 1, version: 7, revision: "a".repeat(64), state: "ready", context: "live", page_path: "/",
  applied: ["metadata", "hero_heading"], unmatched: [], errors: [],
  received_at: new Date().toISOString(), started_at: new Date().toISOString(),
};
let status: DeliveryStatus;
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  status = {
    state: "waiting", message: "Open or reload the connected website to receive its first browser report.",
    published_version: 7, version_created_at: null, expected_revision: "a".repeat(64),
    latest_report: null, latest_preview: null, recent_reports: [],
    field_labels: { metadata: "Browser title and metadata", hero_heading: "Hero heading" },
    fresh_for_seconds: 900, checked_at: new Date().toISOString(),
  };
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: String(url).endsWith("/delivery/") ? status : {
    id: 11, name: "Acme", domain: "acme.example", public_url: "https://acme.example",
    connector_origin: "http://localhost:8080", type: "connected",
  } }));
});

afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/websites/11/publish-status"]}><Routes><Route path="/websites/:id/publish-status" element={<PublishStatusPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByRole("heading", { name: "Publish status" });
}

describe("publish status dashboard", () => {
  it("never treats a published version as confirmed browser delivery", async () => {
    await renderPage();
    expect(screen.getByText("Waiting for the website")).toBeInTheDocument();
    expect(screen.getByText("No website report yet")).toBeInTheDocument();
    expect(screen.getByText("Local testing mode.")).toBeInTheDocument();
    expect(screen.queryByText("Current version reported")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open website" })).toHaveAttribute("href", "https://acme.example");
    expect(screen.getByRole("link", { name: "Back to editor" })).toHaveAttribute("href", "/websites/11/edit");
  });

  it("shows current browser results and field labels without promising a full audit", async () => {
    status = { ...status, state: "reported", latest_report: report, recent_reports: [report] };
    await renderPage();
    expect(screen.getByText("Current version reported")).toBeInTheDocument();
    expect(screen.getByText("Browser title and metadata")).toBeInTheDocument();
    expect(screen.getByText("Hero heading")).toBeInTheDocument();
    expect(screen.getByText(/does not verify image downloads/)).toBeInTheDocument();
  });

  it("renders missing selectors and errors safely with a mapping repair link", async () => {
    const partial: DeliveryReport = { ...report, state: "partial", unmatched: [{ key: "hero_heading", selector: ".missing > h1" }], errors: [{ key: "metadata", message: "<script>alert('x')</script>" }] };
    status = { ...status, state: "partial", latest_report: partial, recent_reports: [partial] };
    await renderPage();
    const issues = screen.getByLabelText("Fields needing attention");
    expect(within(issues).getByText(".missing > h1")).toBeInTheDocument();
    expect(within(issues).getByText("<script>alert('x')</script>")).toBeInTheDocument();
    expect(issues.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: "Review selector mappings" })).toHaveAttribute("href", "/websites/11/mappings");
  });

  it("keeps preview reports separate from actual website confirmation", async () => {
    const preview: DeliveryReport = { ...report, id: 2, context: "preview", page_path: "/connector/v1/proxy/key/" };
    status = { ...status, latest_preview: preview, recent_reports: [preview] };
    await renderPage();
    expect(screen.getByText("Waiting for the website")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inspect report 2" }));
    expect(screen.getByText(/This is a preview report/)).toBeInTheDocument();
    expect(screen.getByText(/no browser on the actual website has reported yet/)).toBeInTheDocument();
  });

  it("refreshes observations without treating a CMS fetch as a website report", async () => {
    await renderPage();
    const before = vi.mocked(api.get).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh reports" }));
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(before));
    const calls = vi.mocked(api.get).mock.calls;
    expect(calls[calls.length - 1]?.[0]).toBe("/v1/sites/11/delivery/");
    expect(screen.getByText("Waiting for the website")).toBeInTheDocument();
  });

  it("reports loading failure and provides a retry instead of a success state", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Offline"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/websites/11/publish-status"]}><Routes><Route path="/websites/:id/publish-status" element={<PublishStatusPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Publish status is unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Current version reported")).not.toBeInTheDocument();
  });
});
