import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Globe2,
  KeyRound, Layers, Loader2, LockKeyhole, Moon, ShieldCheck, Sun, UserRound,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUiStore } from "../../../stores/ui";
import { confirmTwoFactorLogin, login } from "../api";
import "./login.css";

const credentialsSchema = z.object({
  username: z.string().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator."),
});

type Credentials = z.infer<typeof credentialsSchema>;
type CodeForm = z.infer<typeof codeSchema>;

function friendlyError(status: number | undefined): string {
  if (status === 423) return "Your account is temporarily locked. Please try again later.";
  if (status === 429) return "Too many sign-in attempts. Please wait a minute and try again.";
  if (status === 401) return "The username or password is incorrect. Please try again.";
  if (status === 403) return "This account does not have access to this workspace.";
  return "We couldn't connect. Check your connection and try again.";
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${light ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-blue-600 text-white"}`}>
        <Layers size={22} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span>
        <span className={`block text-[15px] font-semibold tracking-tight ${light ? "text-white" : "text-slate-900 dark:text-white"}`}>CMS Platform</span>
        <span className={`block text-[11px] ${light ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>Your websites, together.</span>
      </span>
    </div>
  );
}

function WorkspacePreview() {
  return (
    <div aria-hidden="true" className="login-workspace relative mt-8 rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-300"><Globe2 size={11} /> Your workspace</span>
      </div>
      <div className="flex items-center justify-between py-4">
        <span className="text-xs font-medium text-white">Your websites</span>
        <span className="rounded-md bg-blue-500/20 px-2 py-1 text-[10px] text-blue-200">+ Create website</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#172740]">
          <div className="relative h-24 overflow-hidden bg-[#dce7df] p-3">
            <div className="h-1 w-9 rounded-full bg-[#345c4d]/45" />
            <div className="relative z-10 mt-5 w-16 text-[13px] font-semibold leading-tight tracking-tight text-[#234d3e]">Made to<br />stand out.</div>
            <div className="absolute -bottom-5 right-3 h-24 w-16 rotate-[-18deg] rounded-t-full bg-[#8cac94]" />
            <div className="absolute -bottom-7 right-[-10px] h-24 w-16 rotate-[20deg] rounded-t-full bg-[#456e56]" />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5"><span className="text-[10px] text-slate-200">Studio portfolio</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#172740]">
          <div className="relative h-24 overflow-hidden bg-[#eee5da] p-3">
            <div className="h-1 w-9 rounded-full bg-[#755d4e]/40" />
            <div className="relative z-10 mt-5 w-16 text-[13px] font-semibold leading-tight tracking-tight text-[#6d4d39]">Something<br />wonderful.</div>
            <div className="absolute -right-3 bottom-[-22px] h-28 w-28 rounded-full border-[18px] border-[#c59a78]" />
            <div className="absolute -right-3 bottom-[-22px] h-28 w-28 rounded-full border border-[#876347]/30" />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5"><span className="text-[10px] text-slate-200">Brand website</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300/10 bg-emerald-300/5 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-300"><Check size={13} /></span>
        <div><p className="text-[11px] font-medium text-slate-100">Everything in one place.</p><p className="mt-0.5 text-[10px] text-slate-400">From your first draft to your next launch.</p></div>
      </div>
    </div>
  );
}

const inputClass = "login-input h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-wait disabled:bg-slate-50 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:disabled:bg-slate-800";
const submitClass = "group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_4px_12px_-2px_rgba(37,99,235,0.35)] transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-wait disabled:opacity-70";

export default function LoginPage() {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const [twoFaToken, setTwoFaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 401 ? "That code didn't work. Enter the latest code from your authenticator." : friendlyError(status));
    } finally {
      setBusy(false);
    }
  }

  function backToSignIn() {
    setTwoFaToken(null);
    setError(null);
    codeForm.reset();
  }

  return (
    <main className="min-h-screen bg-[#f3f5f8] p-3 font-sans text-slate-900 dark:bg-[#090f1c] dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100svh-1.5rem)] w-full max-w-[1360px] overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_16px_80px_-32px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-[#111a2b] sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <aside className="login-showcase relative hidden flex-col justify-between overflow-hidden bg-[#101c33] p-10 lg:flex xl:p-12">
          <div className="relative z-10"><Brand light /></div>
          <div className="relative z-10 my-6">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-blue-200"><span className="h-px w-6 bg-blue-300/70" /> A little more possibility</div>
            <h2 className="max-w-md text-[44px] font-semibold leading-[1.12] tracking-[-0.045em] text-white xl:text-[48px]">Big ideas.<br />Beautiful websites.<br /><span className="text-[#9fc2ff]">One workspace.</span></h2>
            <p className="mt-5 max-w-[330px] text-sm leading-7 text-slate-300">Create, connect, and care for your websites. All the tools you need, right where you need them.</p>
            <WorkspacePreview />
          </div>
          <div className="relative z-10 flex items-center gap-2.5 text-xs text-slate-400"><ShieldCheck size={17} className="text-blue-200" aria-hidden="true" /><span>Your next great website starts here.</span></div>
        </aside>

        <section aria-labelledby="login-heading" className="flex min-w-0 flex-col px-6 py-7 sm:px-12 sm:py-10 xl:px-20">
          <div className="flex items-center justify-between gap-4">
            <div className="lg:hidden"><Brand /></div>
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 lg:flex"><LockKeyhole size={13} aria-hidden="true" /> Private workspace</span>
            <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-14 sm:py-20 lg:py-16">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              {twoFaToken ? <ShieldCheck size={23} strokeWidth={1.7} aria-hidden="true" /> : <KeyRound size={23} strokeWidth={1.7} aria-hidden="true" />}
            </div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{twoFaToken ? "One last step" : "Your creative control room"}</p>
            <h1 id="login-heading" className="text-[32px] font-semibold leading-tight tracking-[-0.04em] sm:text-[36px]">{twoFaToken ? "Check your authenticator." : "Welcome back."}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{twoFaToken ? "Enter the 6-digit code from your authenticator app to finish signing in." : "Sign in to your workspace. Let's make something great."}</p>

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></div>
            )}

            {!twoFaToken ? (
              <form onSubmit={creds.handleSubmit(onCredentials)} noValidate aria-busy={busy} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-medium" htmlFor="username">Username</label>
                  <div className="relative">
                    <UserRound size={17} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus placeholder="Enter your username" disabled={busy} aria-invalid={!!creds.formState.errors.username} aria-describedby={creds.formState.errors.username ? "username-error" : undefined} className={inputClass} {...creds.register("username")} />
                  </div>
                  {creds.formState.errors.username && <p id="username-error" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{creds.formState.errors.username.message}</p>}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-[13px] font-medium" htmlFor="password">Password</label>
                    <Link to="/reset-password" className="rounded text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole size={17} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" disabled={busy} aria-invalid={!!creds.formState.errors.password} aria-describedby={creds.formState.errors.password ? "password-error" : undefined} className={`${inputClass} pr-12`} {...creds.register("password")} />
                    <button type="button" disabled={busy} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="password" className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200">
                      {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                  {creds.formState.errors.password && <p id="password-error" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{creds.formState.errors.password.message}</p>}
                </div>
                <div className="pt-2"><button type="submit" disabled={busy} className={submitClass}>{busy ? <><Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Signing in...</> : <>Sign in to workspace <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></>}</button></div>
              </form>
            ) : (
              <form onSubmit={codeForm.handleSubmit(onCode)} noValidate aria-busy={busy} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-medium" htmlFor="code">Authenticator code</label>
                  <input key="authenticator-code" id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="000000" disabled={busy} aria-invalid={!!codeForm.formState.errors.code} aria-describedby={codeForm.formState.errors.code ? "code-error" : "code-hint"} className={`${inputClass} h-14 pl-4 text-center text-xl tracking-[0.5em]`} {...codeForm.register("code")} />
                  {codeForm.formState.errors.code ? <p id="code-error" className="mt-2 text-xs text-red-600 dark:text-red-400">{codeForm.formState.errors.code.message}</p> : <p id="code-hint" className="mt-2 text-xs text-slate-500 dark:text-slate-400">Use the current code before it refreshes.</p>}
                </div>
                <button type="submit" disabled={busy} className={submitClass}>{busy ? <><Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Verifying...</> : <>Verify and sign in <ArrowRight size={17} aria-hidden="true" /></>}</button>
                <button type="button" disabled={busy} onClick={backToSignIn} className="mx-auto flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</button>
              </form>
            )}

            <div className="mt-8 flex items-center gap-3"><span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" /><span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><ShieldCheck size={13} aria-hidden="true" /> Admin access only</span><span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" /></div>
            <p className="mt-5 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">Need access? Contact your workspace administrator.</p>
          </div>

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">A little less managing. A little more creating.</p>
        </section>
      </div>
    </main>
  );
}
