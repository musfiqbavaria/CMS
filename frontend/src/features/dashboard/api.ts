import { api } from "../../shared/api/client";
import type { DashboardOverview } from "./types";

export async function fetchOverview(): Promise<DashboardOverview> {
  const { data } = await api.get<DashboardOverview>("/v1/stats/overview/");
  return data;
}
