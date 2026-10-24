"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions/password-reset-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stethoscope, Lock, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(
    !token ? "Missing or invalid password reset token." : null
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Missing reset token.");
      return;
    }

    setMessage(null);
    setError(null);
    setIsLoading(true);

    try {
      const res = await resetPasswordAction({
        token,
        password,
        confirmPassword,
      });

      if (res.success) {
        setMessage(
          res.message ??
            "Your password has been reset successfully. You can now log in."
        );
      } else {
        setError(res.error ?? "Failed to reset password. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-radial from-slate-100 via-slate-50 to-slate-200 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Create New Password
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Guild Club Services Therapy Portal
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-200/50">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-800">
              Set New Password
            </h2>
            <p className="text-xs text-slate-500">
              Your password must be at least 8 characters and include uppercase,
              lowercase, and numbers.
            </p>
          </div>

          {message && (
            <div className="mb-5 space-y-4">
              <div data-testid="reset-success-message" className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{message}</span>
              </div>
              <Link href="/login">
                <Button data-testid="reset-login-link-button" className="w-full">Proceed to Sign In</Button>
              </Link>
            </div>
          )}

          {error && (
            <div data-testid="reset-error-message" className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!message && token && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  data-testid="reset-password-input"
                  label="New Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <Lock className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-slate-400" />
              </div>

              <div className="relative">
                <Input
                  data-testid="reset-confirm-password-input"
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <Lock className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-slate-400" />
              </div>

              <Button
                data-testid="reset-submit-button"
                type="submit"
                className="w-full mt-2"
                size="lg"
                isLoading={isLoading}
              >
                Reset Password
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
