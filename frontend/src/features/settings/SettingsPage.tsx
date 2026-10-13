import { useState } from "react";
import { changePassword, confirmTwoFactorSetup, disableTwoFactor, fetchTwoFactorSetup, updateMe } from "../auth/account";
import { fetchMe } from "../auth/api";
import { useAuthStore } from "../../stores/auth";
import { Card, CardTitle } from "../../shared/ui/kit";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState({ first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", email: user?.email ?? "" });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [twoFa, setTwoFa] = useState<{ enabled: boolean; secret?: string; otpauth_url?: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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
      setTwoFa({ enabled: false });
      await fetchMe();
      say("ok", "Two-factor authentication disabled.");
    } catch {
      say("err", "Wrong password.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      {msg && (
        <p role={msg.kind === "ok" ? "status" : "alert"} className={`rounded p-2 text-sm ${msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <Card>
        <CardTitle>Profile</CardTitle>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} placeholder="First name" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
          <input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} placeholder="Last name" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
          <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
        </div>
        <button onClick={saveProfile} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white">Save profile</button>
      </Card>

      <Card>
        <CardTitle>Change password</CardTitle>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <input value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} placeholder="Current password" type="password" autoComplete="current-password" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
          <input value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder="New password" type="password" autoComplete="new-password" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
        </div>
        <button onClick={savePassword} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white">Change password</button>
      </Card>

      <Card>
        <CardTitle>Two-factor authentication ({user?.is_2fa_enabled ? "on" : "off"})</CardTitle>
        {!twoFa && (
          <button onClick={loadTwoFa} className="mt-2 rounded border px-3 py-1.5 text-sm dark:border-slate-600">
            {user?.is_2fa_enabled ? "Manage 2FA" : "Set up 2FA"}
          </button>
        )}
        {twoFa && !twoFa.enabled && (
          <div className="mt-2 space-y-2 text-sm">
            <p>Scan this secret into your authenticator app, then confirm with a code:</p>
            <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-700">{twoFa.secret}</p>
            <p className="break-all font-mono text-[11px] text-slate-500">{twoFa.otpauth_url}</p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
              <button onClick={enableTwoFa} className="rounded bg-slate-900 px-3 py-1.5 text-white">Enable</button>
            </div>
          </div>
        )}
        {twoFa?.enabled && (
          <div className="mt-2 flex gap-2 text-sm">
            <input value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Password to disable" type="password" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
            <button onClick={disable} className="rounded border border-red-300 px-3 py-1.5 text-red-600">Disable 2FA</button>
          </div>
        )}
      </Card>
    </div>
  );
}
