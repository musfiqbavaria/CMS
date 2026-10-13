export interface OverviewUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_2fa_enabled: boolean;
  date_joined: string;
}

export interface DashboardOverview {
  users: { total: number; active: number; locked: number; two_fa_enabled: number };
  signups_by_day: { date: string; count: number }[];
  beat_schedules: number;
  recent_users: OverviewUser[];
  system: { db: "ok" | "error"; redis: "ok" | "error"; celery: "ok" | "error" };
}
