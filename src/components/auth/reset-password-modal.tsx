"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordInputWithStrength } from "@/components/auth/password-input-with-strength";
import { CredentialsSuccessModal } from "@/components/auth/credentials-success-modal";
import { Icons } from "@/components/ui/icons";

const AlertCircle = Icons.Alert;
const Eye = Icons.View;
const EyeOff = Icons.View;
const KeyRound = Icons.Security;

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName: string;
  roleLabel: "admin" | "therapist";
  onReset: (params: { userId: string; password: string; confirmPassword: string }) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
  roleLabel,
  onReset,
}: ResetPasswordModalProps) {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Reset state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setResetSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await onReset({
        userId,
        password,
        confirmPassword,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to reset password");
        setIsLoading(false);
        return;
      }

      setResetSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratedPassword = (generated: string) => {
    setPassword(generated);
    setConfirmPassword(generated);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {resetSuccess ? (
          <div className="py-2">
            <CredentialsSuccessModal
              roleLabel={roleLabel}
              title="Password Reset Successfully!"
              email={userEmail}
              password={password}
              onDone={onClose}
              returnLabel="Done"
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-2">
                <KeyRound className="h-5 w-5" />
              </div>
              <DialogTitle className="text-center">Reset Password for {userName}</DialogTitle>
              <DialogDescription className="text-center text-xs">
                Setting a new password will immediately invalidate existing sessions for{" "}
                <span className="font-semibold text-slate-800">{userEmail}</span>.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div
                data-testid="reset-password-error"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <PasswordInputWithStrength
                id="reset-password"
                name="password"
                label="New Password"
                value={password}
                onChange={setPassword}
                onGenerate={handleGeneratedPassword}
                testId="reset-password-input"
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="reset-confirm-password"
                  className="text-xs font-semibold text-slate-700"
                >
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    data-testid="reset-confirm-password-input"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-reset-password-button"
                  type="submit"
                  isLoading={isLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Reset Password
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
