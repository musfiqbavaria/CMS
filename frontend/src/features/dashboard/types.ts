export interface OverviewUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_2fa_enabled: boolean;
  date_joined: string;
}

export interface DashboardSite {
  id: number;
  name: string;
  domain: string;
  type: string;
  status: string;
  verification_status: string;
  integration_mode: string;
  created_at: string;
}

export interface DashboardOverview {
  users: { total: number; active: number; locked: number; two_fa_enabled: number };
  sites: { total: number; active: number; pending: number; inactive: number; connected: number; built: number; verified: number; unverified: number; failed_verification: number; connector_mode: number; proxy_mode: number; built_not_published: number };
  site_creation_by_day: { date: string; count: number }[];
  sites_by_status: { status: string; count: number }[];
  signups_by_day: { date: string; count: number }[];
  beat_schedules: number;
  recent_users: OverviewUser[];
  recent_sites: DashboardSite[];
  system: { db: "ok" | "error"; redis: "ok" | "error"; celery: "ok" | "error" };
}
