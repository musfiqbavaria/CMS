import { useState } from "react";
import { KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import { changePassword, confirmTwoFactorSetup, disableTwoFactor, fetchTwoFactorSetup, updateMe } from "../auth/account";
import { fetchMe } from "../auth/api";
import { useAuthStore } from "../../stores/auth";
import { Badge, Button, Card, CardTitle, CopyButton, PageHeader } from "../../shared/ui/kit";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState({ first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", email: user?.email ?? "" });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [twoFa, setTwoFa] = useState<{ enabled: boolean; secret?: string; otpauth_url?: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try { await action(); } finally { setBusy(false); }
  }

  function say(kind: "ok" | "err", text: string) {
    setMsg({ kind, text });
  }

  async function saveProfile() {
    try {
      const updated = await updateMe(profile);
      useAuthStore.getState().setUser(updated);
      say("ok", "Profile saved.");
    } catch {
      say("err", "Could not save profile.");
    }
  }

  async function savePassword() {
    try {
      await changePassword(pw.old_password, pw.new_password);
      setPw({ old_password: "", new_password: "" });
      say("ok", "Password changed.");
    } catch {
      say("err", "Password change failed (check the current password and length).");
    }
  }

  async function loadTwoFa() {
    try {
      const data = await fetchTwoFactorSetup();
      setTwoFa(data);
      await fetchMe();
    } catch {
      say("err", "Could not load 2FA status.");
    }
  }

  async function enableTwoFa() {
    try {
      const data = await confirmTwoFactorSetup(code);
      setTwoFa(data);
      setCode("");
      await fetchMe();
      say("ok", "Two-factor authentication enabled.");
    } catch {
      say("err", "Invalid code.");
    }
  }

  async function disable() {
    try {
      await disableTwoFactor(disablePw);
      setDisablePw("");
      setTwoFa(null);
      await fetchMe();
      say("ok", "Two-factor authentication disabled.");
    } catch {
      say("err", "Wrong password.");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Account settings" eyebrow="Make yourself at home" description="Your profile, password, and the extra layers that keep your workspace secure." />
      {msg && (
        <p role={msg.kind === "ok" ? "status" : "alert"} className={`rounded p-2 text-sm ${msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-xl font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{(user?.first_name || user?.username || "A").slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><h2 className="font-semibold">{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username}</h2><p className="mt-1 break-all text-xs text-[var(--muted)]">{user?.email}</p></div><Badge tone="blue">{user?.role}</Badge></div>
      </Card>

      <Card>
        <section className="settings-section">
          <div><span className="ui-icon-well mb-3"><UserRound size={20} aria-hidden="true" /></span><CardTitle>Personal details</CardTitle><p className="mt-2 max-w-xs text-xs leading-6 text-[var(--muted)]">A few details to make this workspace yours. Your username stays the same.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); void run(saveProfile); }} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium" htmlFor="profile-first">First name<input id="profile-first" autoComplete="given-name" value={profile.first_name} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} placeholder="First name" className="mt-2 w-full" /></label><label className="text-xs font-medium" htmlFor="profile-last">Last name<input id="profile-last" autoComplete="family-name" value={profile.last_name} onChange={(event) => setProfile({ ...profile, last_name: event.target.value })} placeholder="Last name" className="mt-2 w-full" /></label></div><label className="block text-xs font-medium" htmlFor="profile-email">Email address<input id="profile-email" type="email" autoComplete="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="you@example.com" className="mt-2 w-full" /></label><Button type="submit" variant="primary" disabled={busy}><Save size={14} aria-hidden="true" /> Save profile</Button></form>
        </section>

        <section className="settings-section">
          <div><span className="ui-icon-well mb-3"><KeyRound size={20} aria-hidden="true" /></span><CardTitle>Password</CardTitle><p className="mt-2 max-w-xs text-xs leading-6 text-[var(--muted)]">Use a strong, unique password you don't use on another website.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); void run(savePassword); }} className="space-y-4"><label className="block text-xs font-medium" htmlFor="current-password">Current password<input id="current-password" type="password" autoComplete="current-password" value={pw.old_password} onChange={(event) => setPw({ ...pw, old_password: event.target.value })} className="mt-2 w-full" required /></label><label className="block text-xs font-medium" htmlFor="new-password">New password<input id="new-password" type="password" autoComplete="new-password" value={pw.new_password} onChange={(event) => setPw({ ...pw, new_password: event.target.value })} className="mt-2 w-full" required /></label><Button type="submit" disabled={busy}>Update password</Button></form>
        </section>

        <section className="settings-section">
          <div><span className="ui-icon-well mb-3"><ShieldCheck size={20} aria-hidden="true" /></span><CardTitle>Two-factor authentication</CardTitle><p className="mt-2 max-w-xs text-xs leading-6 text-[var(--muted)]">Add a second layer of security with a code from your authenticator app.</p></div>
          <div><Badge tone={user?.is_2fa_enabled ? "green" : "amber"}>{user?.is_2fa_enabled ? "Enabled" : "Not enabled"}</Badge>
            {!twoFa && <div className="mt-4"><Button disabled={busy} onClick={() => void run(loadTwoFa)}>{user?.is_2fa_enabled ? "Manage 2FA" : "Set up authenticator"}</Button></div>}
            {twoFa && !twoFa.enabled && <div className="mt-4 space-y-4"><p className="text-xs leading-6 text-[var(--muted)]">Add this setup key to your authenticator app, then enter the current code to confirm.</p><div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3"><code className="min-w-0 flex-1 break-all text-xs">{twoFa.secret}</code>{twoFa.secret && <CopyButton text={twoFa.secret} />}</div><details className="text-xs text-[var(--muted)]"><summary className="cursor-pointer">Show authenticator link</summary><p className="mt-2 break-all font-mono text-[10px]">{twoFa.otpauth_url}</p></details><form onSubmit={(event) => { event.preventDefault(); void run(enableTwoFa); }} className="flex flex-wrap items-end gap-2"><label className="min-w-0 text-xs font-medium" htmlFor="setup-code">Authenticator code<input id="setup-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mt-2 block w-40 tracking-widest" required /></label><Button type="submit" variant="primary" disabled={busy}>Enable 2FA</Button></form></div>}
            {twoFa?.enabled && <form onSubmit={(event) => { event.preventDefault(); void run(disable); }} className="mt-4 space-y-4"><label className="block text-xs font-medium" htmlFor="disable-password">Confirm your password<input id="disable-password" value={disablePw} onChange={(event) => setDisablePw(event.target.value)} type="password" autoComplete="current-password" className="mt-2 w-full" required /></label><Button type="submit" variant="danger" disabled={busy}>Disable 2FA</Button></form>}
          </div>
        </section>
      </Card>
    </div>
  );
}
