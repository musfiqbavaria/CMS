import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Reset password</h1>
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
              <button type="submit" className="w-full rounded bg-slate-900 p-2 font-medium text-white">
                Set new password
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
              <button type="submit" className="w-full rounded bg-slate-900 p-2 font-medium text-white">
                Send reset link
              </button>
            </form>
          ))}
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-slate-600 underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
