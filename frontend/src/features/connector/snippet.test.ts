import { describe, expect, it } from "vitest";
import { cmsOrigin, connectorSnippet, isLocalCmsOrigin, proxyDemoUrl } from "./snippet";

describe("connector snippet", () => {
  it("builds a loader tag and proxy demo url", () => {
    expect(connectorSnippet("https://cms.example.com", "KEY123")).toBe(
      '<script src="https://cms.example.com/connector/v1/loader.js?site=KEY123" async></script>',
    );
    expect(proxyDemoUrl("https://cms.example.com", "KEY123")).toBe(
      "https://cms.example.com/connector/v1/proxy/KEY123/",
    );
  });

  it("uses an explicitly configured public CMS origin", () => {
    expect(cmsOrigin("https://cms.example.com/")).toBe("https://cms.example.com");
    expect(connectorSnippet("https://cms.example.com/", "key&other=value")).toContain("?site=key%26other%3Dvalue");
    expect(() => connectorSnippet("javascript:alert(1)", "key")).toThrow();
  });

  it.each(["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080", "http://192.168.1.5", "http://172.16.0.1", "http://backend:8000"])("identifies %s as local-only", (origin) => {
    expect(isLocalCmsOrigin(origin)).toBe(true);
  });

  it("does not label a public CMS domain as local", () => {
    expect(isLocalCmsOrigin("https://cms.example.com")).toBe(false);
  });
});
