export type SiteType = "connected" | "built";
export type SiteStatus = "pending" | "active" | "inactive";
export type VerificationStatus = "pending" | "verified" | "failed";
export type IntegrationMode = "connector" | "proxy";

export type DiscoveryStatus = "pending" | "running" | "succeeded" | "failed";

export interface SiteDomain {
  id: number;
  hostname: string;
  kind: "managed" | "custom";
  is_primary: boolean;
  verification_status: VerificationStatus;
  verification_error: string;
  verified_at: string | null;
  created_at: string;
  dns: {
    cname_host: string;
    cname_target: string;
    txt_host: string;
    txt_value: string;
  } | null;
}

export interface Site {
  id: number;
  name: string;
  domain: string;
  is_managed: boolean;
  public_url: string;
  domains: SiteDomain[];
  homepage: number | null;
  site_key: string;
  connector_origin?: string;
  type: SiteType;
  status: SiteStatus;
  integration_mode: IntegrationMode;
  verification_status: VerificationStatus;
  verification_token: string;
  verification_method: string;
  verification_error: string;
  verified_at: string | null;
  discovery: Record<string, string | number>;
  discovery_status: DiscoveryStatus;
  discovery_error: string;
  discovered_at: string | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AuditEntry {
  id: number;
  actor: number | null;
  actor_username: string | null;
  action: string;
  model: string;
  object_id: string;
  site: number | null;
  site_display: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface SiteListParams {
  page: number;
  page_size: number;
  search?: string;
  type?: string;
  status?: string;
  ordering?: string;
}

export interface SiteFormValues {
  name: string;
  domain?: string;
  subdomain?: string;
  type: SiteType;
  integration_mode: IntegrationMode;
}
