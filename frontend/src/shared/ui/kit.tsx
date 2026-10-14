import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h2>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300" />
      {label}
    </p>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700",
  danger: "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950",
  ghost: "text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    />
  );
}

type BadgeTone = "green" | "red" | "amber" | "blue" | "slate";

const BADGE_STYLES: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function Badge({ tone = "slate", children, className = "" }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${BADGE_STYLES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: "ok" | "error" | "unknown" }) {
  const color =
    status === "ok" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-slate-400";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-sm capitalize">{status}</span>
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-600 dark:bg-slate-800">
      <p className="font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        const done = () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        };
        try {
          const clip = navigator?.clipboard;
          if (clip) void clip.writeText(text).then(done, done);
          else done();
        } catch {
          done();
        }
      }}
      className="rounded border px-2 py-1 text-xs dark:border-slate-600"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

/** Human-friendly relative time ("just now", "5m ago", …); falls back to locale string. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
