"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, logoutAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, ShieldAlert, AlertCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        if (res.error) {
          setGeneralError(res.error);
        }
        setIsLoading(false);
        return;
      }

      if (res.redirectTo) {
        router.push(res.redirectTo);
        router.refresh();
      }
    } catch {
      setGeneralError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-radial from-slate-100 via-slate-50 to-slate-200 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Password Change Required
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            For security compliance, you must set a new personal password before
            accessing the portal.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs">
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Your account has the <strong className="font-semibold">must_change_password</strong> policy active. All access is restricted until you update your credentials.
            </span>
          </div>

          {generalError && (
            <div
              data-testid="change-password-error-message"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              data-testid="current-password-input"
              label="Current (Temporary) Password"
              type="password"
              placeholder="••••••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={fieldErrors.currentPassword}
              required
              autoComplete="current-password"
            />

            <Input
              data-testid="new-password-input"
              label="New Password"
              type="password"
              placeholder="••••••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={fieldErrors.newPassword}
              helperText="Minimum 8 characters with at least one uppercase letter, one lowercase letter, and one number."
              required
              autoComplete="new-password"
            />

            <Input
              data-testid="confirm-password-input"
              label="Confirm New Password"
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword}
              required
              autoComplete="new-password"
            />

            <Button
              data-testid="change-password-submit-button"
              type="submit"
              className="w-full mt-2"
              size="lg"
              isLoading={isLoading}
            >
              Update Password & Enter Portal
            </Button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
              >
                Sign out instead
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
