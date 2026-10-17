import { describe, expect, it } from "vitest";
import { editableDraft, editorMessage, EDIT_TARGETS, isCmsPreview, isEditTarget, liveEditUrl } from "./clickToEdit";
import { EDITOR_TABS } from "./types";

const channel = "a".repeat(32);

describe("click-to-edit boundaries", () => {
  it("maps only known connector fields to existing editor sections", () => {
    for (const target of Object.values(EDIT_TARGETS)) expect(EDITOR_TABS.some((tab) => tab.key === target.section)).toBe(true);
    expect(isEditTarget("hero_heading")).toBe(true);
    for (const key of ["__proto__", "constructor", "publish", "", null]) expect(isEditTarget(key)).toBe(false);
  });

  it("uses CMS previews only, never instruments an arbitrary external website", () => {
    expect(isCmsPreview("/connector/v1/preview/site-key/")).toBe(true);
    expect(isCmsPreview("https://other.example/connector/v1/preview/site-key/")).toBe(false);
    expect(isCmsPreview("/connector/v1/proxy/site-key/")).toBe(false);
    expect(isCmsPreview("javascript:alert(1)")).toBe(false);
    const url = new URL(liveEditUrl("/connector/v1/preview/key/?path=/about", channel));
    expect(url.searchParams.get("path")).toBe("/about");
    expect(url.searchParams.get("edit_channel")).toBe(channel);
  });

  it("injects an external bridge with escaped JSON, not user executable markup", () => {
    const html = editableDraft("<!doctype html><html><head><title>T</title></head><body><h1>Content</h1></body></html>", channel);
    const document = new DOMParser().parseFromString(html, "text/html");
    const script = document.querySelector("script")!;
    expect(script.getAttribute("src")).toBe(`${window.location.origin}/connector/v1/editor-bridge.js`);
    const config = JSON.parse(script.getAttribute("data-cms-editor-config")!);
    expect(config.channel).toBe(channel);
    expect(config.targets.find((target: { key: string }) => target.key === "hero_heading").selector).toBe('[data-cms-edit="hero_heading"]');
    expect(document.querySelector("h1")?.textContent).toBe("Content");
  });

  it("accepts selection only from the current opaque iframe and current channel", () => {
    const frame = document.createElement("iframe"); document.body.append(frame);
    const event = (data: unknown, source: Window | null = frame.contentWindow, origin = "null") => new MessageEvent("message", { data, source, origin });
    const good = { type: "cms:editor:select", channel, key: "hero_heading" };
    expect(editorMessage(event(good), frame.contentWindow, channel)).toEqual({ type: "select", key: "hero_heading" });
    expect(editorMessage(event(good, window), frame.contentWindow, channel)).toBeNull();
    expect(editorMessage(event(good, frame.contentWindow, "https://evil.example"), frame.contentWindow, channel)).toBeNull();
    expect(editorMessage(event({ ...good, channel: "old" }), frame.contentWindow, channel)).toBeNull();
    expect(editorMessage(event({ ...good, key: "__proto__" }), frame.contentWindow, channel)).toBeNull();
    expect(editorMessage(event({ ...good, type: "publish" }), frame.contentWindow, channel)).toBeNull();
    frame.remove();
  });

  it("bounds scroll and readiness reports", () => {
    const frame = document.createElement("iframe"); document.body.append(frame);
    const parse = (type: string, fields: object) => editorMessage(new MessageEvent("message", { source: frame.contentWindow, origin: "null", data: { type: `cms:editor:${type}`, channel, ...fields } }), frame.contentWindow, channel);
    expect(parse("ready", { count: 12 })).toEqual({ type: "ready", count: 12 });
    expect(parse("ready", { count: -1 })).toBeNull();
    expect(parse("scroll", { y: 200 })).toEqual({ type: "scroll", y: 200 });
    expect(parse("scroll", { y: Infinity })).toBeNull();
    expect(parse("scroll", { y: -1 })).toBeNull();
    frame.remove();
  });
});
