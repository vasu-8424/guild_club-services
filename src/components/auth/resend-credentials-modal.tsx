"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { resendCredentialsAction } from "@/lib/actions/admin-actions";

interface ResendCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  roleLabel: "admin" | "therapist";
}

export function ResendCredentialsModal({
  isOpen,
  onClose,
  userId,
  userName,
  userEmail,
  roleLabel,
}: ResendCredentialsModalProps) {
  const [useCustomPassword, setUseCustomPassword] = React.useState(false);
  const [customPassword, setCustomPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resultData, setResultData] = React.useState<{
    newPassword?: string;
    emailSent: boolean;
    warning?: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setUseCustomPassword(false);
      setCustomPassword("");
      setError(null);
      setResultData(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopy = async () => {
    if (!resultData?.newPassword) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${userEmail}\nTemporary Password: ${resultData.newPassword}\nSign in: ${window.location.origin}/login`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await resendCredentialsAction({
        userId,
        password: useCustomPassword ? customPassword : undefined,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to resend credentials");
        setIsLoading(false);
        return;
      }

      setResultData(res.data ?? { emailSent: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-none border border-slate-200">
        {!resultData ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-[#0B7A63] border border-emerald-200">
                  <Icons.Envelope />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Resend Credentials
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Generate a new temporary password and email sign-in details to{" "}
                    <strong className="text-slate-800">{userName}</strong>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {error && (
              <div
                data-testid="resend-credentials-error"
                className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="p-3 bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Security Notice</p>
                <p className="text-[11px] text-amber-800">
                  Resending credentials will immediately invalidate all existing sessions and set a new temporary password. The user will be asked to change it upon signing in.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={useCustomPassword}
                    onChange={(e) => setUseCustomPassword(e.target.checked)}
                    className="h-4 w-4 rounded-none border-slate-300 text-[#0B7A63] focus:ring-[#0B7A63]"
                  />
                  <span>Specify custom temporary password</span>
                </label>

                {useCustomPassword && (
                  <div className="pt-1">
                    <Input
                      data-testid="custom-temp-password-input"
                      type="text"
                      placeholder="Minimum 8 characters (letters and numbers)"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      required={useCustomPassword}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="rounded-none"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-resend-credentials-button"
                  type="submit"
                  variant="primary"
                  isLoading={isLoading}
                  className="rounded-none bg-[#0B7A63] hover:bg-[#096350]"
                >
                  Generate & Send Email
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Icons.Check />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    New Credentials Generated
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    {resultData.emailSent
                      ? `Credentials email has been sent to ${userEmail}.`
                      : `Credentials generated, but email delivery had issues.`}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {resultData.warning && (
                <div
                  data-testid="resend-credentials-warning"
                  className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800"
                >
                  {resultData.warning}
                </div>
              )}

              {resultData.newPassword && (
                <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      One-time Temporary Password
                    </span>
                    <button
                      type="button"
                      data-testid="copy-credentials-button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B7A63] hover:underline"
                    >
                      <Icons.Copy />
                      {copied ? "Copied!" : "Copy Details"}
                    </button>
                  </div>
                  <div
                    data-testid="new-temp-password-box"
                    className="p-2.5 bg-white border border-slate-300 font-mono text-sm text-slate-900 select-all"
                  >
                    {resultData.newPassword}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    This password will not be shown again. Please copy and share it securely if the email could not be delivered.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  data-testid="close-resend-credentials-modal-button"
                  variant="primary"
                  onClick={onClose}
                  className="rounded-none bg-[#0B7A63] hover:bg-[#096350]"
                >
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
