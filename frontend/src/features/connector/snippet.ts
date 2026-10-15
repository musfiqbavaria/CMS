function normalizedOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Use a complete HTTP(S) CMS origin without a path or credentials.");
  }
  return url.origin;
}

export function cmsOrigin(configured?: string): string {
  const value = configured?.trim() || import.meta.env?.VITE_CMS_PUBLIC_URL?.trim() || window.location.origin;
  try { return normalizedOrigin(value); } catch { return window.location.origin; }
}

export function isLocalCmsOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" || host === "::" || (host.includes(":") && /^(fc|fd|fe80:)/i.test(host))) return true;
    const ipv4 = host.split(".").map(Number);
    if (ipv4.length === 4 && ipv4.every(Number.isFinite)) return ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 192 && ipv4[1] === 168) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31);
    return !host.includes(".") && !host.includes(":");
  } catch { return true; }
}

export function connectorSnippet(origin: string, siteKey: string): string {
  return `<script src="${normalizedOrigin(origin)}/connector/v1/loader.js?site=${encodeURIComponent(siteKey)}" async></script>`;
}

export function proxyDemoUrl(origin: string, siteKey: string): string {
  return `${normalizedOrigin(origin)}/connector/v1/proxy/${encodeURIComponent(siteKey)}/`;
}
