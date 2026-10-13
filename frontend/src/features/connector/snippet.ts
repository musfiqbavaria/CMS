export function cmsOrigin(): string {
  return window.location.origin;
}

export function connectorSnippet(origin: string, siteKey: string): string {
  return `<script src="${origin}/connector/v1/loader.js?site=${siteKey}" async></script>`;
}

export function proxyDemoUrl(origin: string, siteKey: string): string {
  return `${origin}/connector/v1/proxy/${siteKey}/`;
}
