import type { SiteStatus, SiteType, VerificationStatus } from "../types";

function pill(color: string, label: string) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: SiteStatus }) {
  if (status === "active") return pill("bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", "Active");
  if (status === "inactive") return pill("bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200", "Inactive");
  return pill("bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", "Pending");
}

export function TypeBadge({ type }: { type: SiteType }) {
  if (type === "built") return pill("bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", "Built");
  return pill("bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", "Connected");
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "verified")
    return pill("bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", "Verified");
  if (status === "failed") return pill("bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", "Failed");
  return pill("bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300", "Unverified");
}
