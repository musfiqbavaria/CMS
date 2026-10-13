import { describe, expect, it } from "vitest";
import { connectorSnippet, proxyDemoUrl } from "./snippet";

describe("connector snippet", () => {
  it("builds a loader tag and proxy demo url", () => {
    expect(connectorSnippet("https://cms.example.com", "KEY123")).toBe(
      '<script src="https://cms.example.com/connector/v1/loader.js?site=KEY123" async></script>',
    );
    expect(proxyDemoUrl("https://cms.example.com", "KEY123")).toBe(
      "https://cms.example.com/connector/v1/proxy/KEY123/",
    );
  });
});
