import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { confirmTwoFactorLogin, login } from "../api";

const credentialsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const codeSchema = z.object({
  code: z.string().min(6, "Enter the 6-digit code").max(8),
});

type Credentials = z.infer<typeof credentialsSchema>;
type CodeForm = z.infer<typeof codeSchema>;

function friendlyError(status: number | undefined): string {
  if (status === 423) return "Account locked after too many failed attempts. Try again later.";
  if (status === 429) return "Too many attempts. Slow down and try again in a minute.";
  if (status === 401) return "Invalid username or password.";
  if (status === 403) return "This account is not allowed to access the admin panel.";
  return "Login failed. Check the connection and try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [twoFaToken, setTwoFaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creds = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) });
  const codeForm = useForm<CodeForm>({ resolver: zodResolver(codeSchema) });

  async function onCredentials(data: Credentials) {
    setBusy(true);
    setError(null);
    try {
      const result = await login(data.username, data.password);
      if (result.requires_2fa) {
        setTwoFaToken(result.two_fa_token ?? null);
      } else {
        navigate("/", { replace: true });
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(friendlyError(status));
    } finally {
      setBusy(false);
    }
  }

  async function onCode(data: CodeForm) {
    if (!twoFaToken) return;
    setBusy(true);
    setError(null);
    try {
      await confirmTwoFactorLogin(twoFaToken, data.code);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid two-factor code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-stretch justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-2xl shadow-xl">
        <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-800 via-slate-900 to-black p-8 text-white md:flex">
          <p className="text-lg font-bold">CMS Platform</p>
          <div>
            <h2 className="text-2xl font-bold leading-snug">Every website,<br />one control room.</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li className="flex gap-2"><span aria-hidden>🌐</span> Hosted subdomains + custom domains</li>
              <li className="flex gap-2"><span aria-hidden>🧱</span> Visual builder with templates</li>
              <li className="flex gap-2"><span aria-hidden>📡</span> Uptime, SSL and connector monitoring</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">Secure admin access · 2FA supported</p>
        </div>
        <div className="w-full bg-white p-6 dark:bg-slate-800 sm:p-8 md:w-1/2">
          <h1 className="text-xl font-bold">CMS Platform</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {twoFaToken ? "Enter your authenticator code" : "Admin sign in"}
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {!twoFaToken ? (
            <form onSubmit={creds.handleSubmit(onCredentials)} className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium" htmlFor="username">Username</label>
                <input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  className="mt-1 w-full rounded-lg border p-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:focus:border-slate-400 dark:focus:ring-slate-600"
                  {...creds.register("username")}
                />
                {creds.formState.errors.username && (
                  <p className="text-xs text-red-600">{creds.formState.errors.username.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border p-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:focus:border-slate-400 dark:focus:ring-slate-600"
                  {...creds.register("password")}
                />
                {creds.formState.errors.password && (
                  <p className="text-xs text-red-600">{creds.formState.errors.password.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-slate-900 p-2.5 font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <p className="text-center text-sm">
                <Link to="/reset-password" className="text-slate-600 underline dark:text-slate-300">
                  Forgot password?
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={codeForm.handleSubmit(onCode)} className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium" htmlFor="code">Authenticator code</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  className="mt-1 w-full rounded-lg border p-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-700"
                  {...codeForm.register("code")}
                />
                {codeForm.formState.errors.code && (
                  <p className="text-xs text-red-600">{codeForm.formState.errors.code.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-slate-900 p-2.5 font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
