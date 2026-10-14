/**
 * Public URL for a customer hostname. Uses plain http + the current port when
 * the admin is browsed over plain local http (no TLS on a dev PC);
 * https everywhere else.
 */
export function publicSiteUrl(hostOrUrl: string): string {
  let host = (hostOrUrl || "").trim().toLowerCase();
  for (const prefix of ["https://", "http://"]) {
    if (host.startsWith(prefix)) host = host.slice(prefix.length);
  }
  host = host.split("/")[0].split(":")[0].replace(/\.$/, "");
  if (typeof window !== "undefined") {
    const loc = window.location.hostname.toLowerCase();
    const local = loc === "localhost" || loc === "127.0.0.1";
    if (local && (host === "localhost" || host.endsWith(".localhost"))) {
      const port = window.location.port ? `:${window.location.port}` : "";
      return `http://${host}${port}`;
    }
  }
  return `https://${host}`;
}
