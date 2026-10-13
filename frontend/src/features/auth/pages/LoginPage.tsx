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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">CMS Platform</h1>
        <p className="mt-1 text-sm text-slate-500">
          {twoFaToken ? "Enter your authenticator code" : "Admin sign in"}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">
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
                className="mt-1 w-full rounded border p-2"
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
                className="mt-1 w-full rounded border p-2"
                {...creds.register("password")}
              />
              {creds.formState.errors.password && (
                <p className="text-xs text-red-600">{creds.formState.errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-slate-900 p-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-sm">
              <Link to="/reset-password" className="text-slate-600 underline">
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
                className="mt-1 w-full rounded border p-2"
                {...codeForm.register("code")}
              />
              {codeForm.formState.errors.code && (
                <p className="text-xs text-red-600">{codeForm.formState.errors.code.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-slate-900 p-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
