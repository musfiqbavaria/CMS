import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Layers } from "lucide-react";
import { confirmPasswordReset, requestPasswordReset } from "../api";

const emailSchema = z.object({ email: z.string().email("Enter a valid email") });
const resetSchema = z
  .object({
    new_password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get("uid");
  const token = params.get("token");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  async function onRequest(data: z.infer<typeof emailSchema>) {
    setError(null);
    try {
      await requestPasswordReset(data.email);
      setDone("If the email is registered, a reset link was sent.");
    } catch {
      setError("Request failed. Try again.");
    }
  }

  async function onConfirm(data: z.infer<typeof resetSchema>) {
    setError(null);
    if (!uid || !token) return;
    try {
      await confirmPasswordReset(uid, token, data.new_password);
      setDone("Password reset. You can now sign in.");
    } catch {
      setError("Invalid or expired reset link.");
    }
  }

  return (
    <main className="app-content flex min-h-screen flex-col items-center justify-center gap-7 bg-[var(--canvas)] p-5 text-[var(--ink)]">
      <Link to="/login" className="flex items-center gap-2.5 text-sm font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Layers size={20} aria-hidden="true" /></span>CMS Platform</Link>
      <div className="ui-card w-full max-w-[420px] !p-7 sm:!p-9">
        <span className="ui-icon-well mb-5"><KeyRound size={21} aria-hidden="true" /></span>
        <div className="ui-eyebrow">Let's get you back in</div>
        <h1>{uid && token ? "Choose a new password" : "Reset your password"}</h1>
        <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{uid && token ? "Choose a strong password to keep your workspace secure." : "Enter your account email and we'll send you a link to reset your password."}</p>
        {done && (
          <p role="status" className="mt-4 rounded bg-green-50 p-2 text-sm text-green-700">
            {done}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {!done &&
          (uid && token ? (
            <form onSubmit={resetForm.handleSubmit(onConfirm)} className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium" htmlFor="new_password">New password</label>
                <input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded border p-2"
                  {...resetForm.register("new_password")}
                />
                {resetForm.formState.errors.new_password && (
                  <p className="text-xs text-red-600">{resetForm.formState.errors.new_password.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded border p-2"
                  {...resetForm.register("confirm")}
                />
                {resetForm.formState.errors.confirm && (
                  <p className="text-xs text-red-600">{resetForm.formState.errors.confirm.message}</p>
                )}
              </div>
              <button type="submit" disabled={resetForm.formState.isSubmitting} className="ui-button w-full" data-variant="primary">
                {resetForm.formState.isSubmitting ? "Updating..." : "Set new password"}
              </button>
            </form>
          ) : (
            <form onSubmit={emailForm.handleSubmit(onRequest)} className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded border p-2"
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-red-600">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <button type="submit" disabled={emailForm.formState.isSubmitting} className="ui-button w-full" data-variant="primary">
                {emailForm.formState.isSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          ))}
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]">
            <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
