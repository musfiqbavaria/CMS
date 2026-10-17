import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EDITOR_TABS } from "../types";
import { EditorPreview, EditorSections, SECTION_DETAILS, SECTION_GROUPS } from "./EditorWorkspace";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("EditorSections", () => {
  it("includes every existing editor section exactly once", () => {
    const keys = SECTION_GROUPS.flatMap((group) => group.sections);
    expect([...keys].sort()).toEqual(EDITOR_TABS.map((tab) => tab.key).sort());
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(SECTION_DETAILS[key].description).not.toBe("");
  });

  it("selects sections from the grouped navigation and mobile picker", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<EditorSections active="general" onSelect={onSelect} />);
    const navigation = screen.getByRole("navigation", { name: "Editor sections" });
    expect(within(navigation).getByRole("button", { name: "General" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(navigation).getByRole("button", { name: "Hero Section" }));
    expect(onSelect).toHaveBeenLastCalledWith("hero");
    rerender(<EditorSections active="hero" onSelect={onSelect} />);
    expect(within(navigation).getByRole("button", { name: "Hero Section" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Choose an editor section")).toHaveValue("hero");
    fireEvent.change(screen.getByLabelText("Choose an editor section"), { target: { value: "branding" } });
    expect(onSelect).toHaveBeenLastCalledWith("branding");
  });
});

describe("EditorPreview", () => {
  it("ignores an earlier document's channel and ignores selections when click-to-edit is off", () => {
    const onSelect = vi.fn();
    const html = '<html><head></head><body><h1 data-cms-edit="hero_heading">Old</h1></body></html>';
    const { rerender } = render(<EditorPreview html={html} liveUrl={null} onSelect={onSelect} onEdit={vi.fn()} />);
    const frame = screen.getByTitle("Draft preview") as HTMLIFrameElement;
    const channel = () => JSON.parse(new DOMParser().parseFromString(frame.getAttribute("srcdoc")!, "text/html").querySelector("[data-cms-editor-config]")!.getAttribute("data-cms-editor-config")!).channel;
    const first = channel();
    const select = (current: string) => fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:select", channel: current, key: "hero_heading" } }));
    select(first);
    expect(onSelect).toHaveBeenCalledWith("hero_heading");
    onSelect.mockClear();
    rerender(<EditorPreview html={html.replace("Old", "New")} liveUrl={null} onSelect={onSelect} onEdit={vi.fn()} />);
    expect(channel()).not.toBe(first);
    select(first);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Click to edit" }));
    select(channel());
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/Selection is off/)).toBeInTheDocument();
  });

  it("only enables live click-to-edit on the verified CMS preview endpoint", () => {
    render(<EditorPreview html="<html><head></head><body>Draft</body></html>" liveUrl="https://example.com/" onSelect={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    expect(screen.getByRole("button", { name: "Click to edit" })).toBeDisabled();
    expect(screen.getByTitle("Live website preview")).toHaveAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
    expect(screen.getByTitle("Live website preview")).toHaveAttribute("src", "https://example.com/");
  });

  it("keeps the verified CMS preview browseable while staying opaque and sandboxed", () => {
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl="/connector/v1/preview/testsite/" onSelect={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    const frame = screen.getByTitle("Live website preview") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toContain("allow-popups");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
    const channel = new URL(frame.getAttribute("src")!, window.location.origin).searchParams.get("edit_channel");
    fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:ready", channel, count: 5 } }));
    expect(screen.getByText(/5 editable areas on this page/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Click to edit" }));
    expect(screen.getByText(/Links browse the live pages/)).toBeInTheDocument();
    expect(screen.getByText(/5 editable areas on this page/)).toBeInTheDocument();
  });

  it("sends back and forward history commands to the live preview bridge only", () => {
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl="/connector/v1/preview/testsite/" onSelect={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    const frame = screen.getByTitle("Live website preview") as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    const channel = new URL(frame.getAttribute("src")!, window.location.origin).searchParams.get("edit_channel");
    expect(channel).toMatch(/^[a-f0-9]{32}$/);
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, { type: "cms:editor:back", channel }, "*");
    expect(postMessage).toHaveBeenNthCalledWith(2, { type: "cms:editor:forward", channel }, "*");
  });
  it("switches the actual iframe viewport without losing its draft content or sandbox", () => {
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl="https://example.com" onEdit={vi.fn()} />);
    const frame = screen.getByTitle("Draft preview");
    expect(screen.getByRole("button", { name: "Desktop preview" })).toHaveAttribute("aria-pressed", "true");
    expect(frame).toHaveStyle({ width: "1280px" });
    fireEvent.click(screen.getByRole("button", { name: "Tablet preview" }));
    expect(frame).toHaveStyle({ width: "768px" });
    fireEvent.click(screen.getByRole("button", { name: "Mobile preview" }));
    expect(screen.getByRole("button", { name: "Mobile preview" })).toHaveAttribute("aria-pressed", "true");
    expect(frame).toHaveStyle({ width: "390px" });
    expect(frame).toHaveAttribute("srcdoc", "<h1>My draft</h1>");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(screen.getByText(/not your website’s exact layout/)).toBeInTheDocument();
  });

  it("scales the canvas to the available panel width and responds to resizing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);
    render(<EditorPreview html="<h1>Preview</h1>" liveUrl={null} onEdit={vi.fn()} />);
    const frame = screen.getByTitle("Draft preview");
    expect(frame).toHaveStyle({ transform: "scale(0.25)" });
    width.mockReturnValue(640);
    fireEvent(window, new Event("resize"));
    expect(frame).toHaveStyle({ transform: "scale(0.5)" });
  });

  it("updates the preview when the draft changes and returns to editing", () => {
    const onEdit = vi.fn();
    const { rerender } = render(<EditorPreview html="Old draft" liveUrl={null} onEdit={onEdit} />);
    rerender(<EditorPreview html="Updated draft" liveUrl={null} onEdit={onEdit} />);
    expect(screen.getByTitle("Draft preview")).toHaveAttribute("srcdoc", "Updated draft");
    fireEvent.click(screen.getByRole("button", { name: "Back to editing" }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("switches to the original live website on demand", () => {
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl="https://example.com" onEdit={vi.fn()} />);
    expect(screen.getByTitle("Draft preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    const frame = screen.getByTitle("Live website preview");
    expect(frame).toHaveAttribute("src", "https://example.com");
    fireEvent.click(screen.getByRole("button", { name: "Draft design" }));
    expect(screen.getByTitle("Draft preview")).toBeInTheDocument();
  });

  it("hides the live toggle when no live URL is known", () => {
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl={null} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Live website" })).not.toBeInTheDocument();
  });

  it("edits page text blocks selected in the live preview and removes them from the page", () => {
    const onSelect = vi.fn();
    const onBlockUpdate = vi.fn();
    const onBlockRemove = vi.fn();
    const block = { id: "b0123456789abcdef", path: "/jobs", label: "Jobs banner heading", selector: "section.public-hero h1", text: "Find Your Next Opportunity at Bavaria" };
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl="/connector/v1/preview/testsite/" onSelect={onSelect} onEdit={vi.fn()} blocks={[block]} onBlockUpdate={onBlockUpdate} onBlockRemove={onBlockRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    const frame = screen.getByTitle("Live website preview") as HTMLIFrameElement;
    const channel = new URL(frame.getAttribute("src")!, window.location.origin).searchParams.get("edit_channel");
    fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:select", channel, key: block.id } }));
    expect(onSelect).not.toHaveBeenCalled();
    const input = screen.getByLabelText("Page text");
    expect(input).toHaveValue("Find Your Next Opportunity at Bavaria");
    expect(screen.getByText(/Shown only on \/jobs/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Join the team" } });
    expect(onBlockUpdate).toHaveBeenCalledWith(block.id, "Join the team");
    fireEvent.click(screen.getByRole("button", { name: "Remove this page text" }));
    expect(onBlockRemove).toHaveBeenCalledWith(block.id);
    expect(screen.queryByLabelText("Page text")).not.toBeInTheDocument();
  });

  it("offers to make unmapped text editable on its page and creates a page text block", async () => {
    const onBlockCreate = vi.fn();
    const props = { html: "<h1>My draft</h1>", liveUrl: "/connector/v1/preview/testsite/", onSelect: vi.fn(), onEdit: vi.fn(), onBlockCreate, onBlockUpdate: vi.fn(), onBlockRemove: vi.fn() };
    const { rerender } = render(<EditorPreview {...props} blocks={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    const frame = screen.getByTitle("Live website preview") as HTMLIFrameElement;
    const channel = new URL(frame.getAttribute("src")!, window.location.origin).searchParams.get("edit_channel");
    fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:ready", channel, count: 4, path: "/jobs" } }));
    fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:unmapped", channel, path: "/jobs", selector: "section.public-hero h1", label: "Find Your Next Opportunity at Bavaria" } }));
    expect(screen.getByText(/This area is not editable yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Make this text editable" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onBlockCreate).toHaveBeenCalledOnce();
    const created = onBlockCreate.mock.calls[0][0] as { id: string; path: string; selector: string; label: string; text: string };
    expect(created).toMatchObject({ path: "/jobs", selector: "section.public-hero h1", label: "Find Your Next Opportunity at Bavaria", text: "" });
    expect(created.id).toMatch(/^b[0-9a-f]{16}$/);
    // The reload keeps the browsed page so the writing context never jumps to the home page.
    const reloaded = screen.getByTitle("Live website preview") as HTMLIFrameElement;
    expect(reloaded.getAttribute("src")).toContain("path=%2Fjobs");
    rerender(<EditorPreview {...props} blocks={[created]} />);
    expect(screen.getByLabelText("Page text")).toHaveValue("");
    expect(screen.queryByText(/This area is not editable yet/)).not.toBeInTheDocument();
  });

  it("keeps the plain guidance when the clicked area cannot become a page text", () => {
    render(<EditorPreview html="<h1>My draft</h1>" liveUrl="/connector/v1/preview/testsite/" onSelect={vi.fn()} onEdit={vi.fn()} onBlockCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Live website" }));
    const frame = screen.getByTitle("Live website preview") as HTMLIFrameElement;
    const channel = new URL(frame.getAttribute("src")!, window.location.origin).searchParams.get("edit_channel");
    fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:ready", channel, count: 4 } }));
    fireEvent(window, new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: "cms:editor:unmapped", channel } }));
    expect(screen.getByText(/This area is not mapped/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Make this text editable" })).not.toBeInTheDocument();
  });
});
