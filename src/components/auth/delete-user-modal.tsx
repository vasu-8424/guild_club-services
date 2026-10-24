"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";

const AlertCircle = Icons.Alert;
const Trash2 = Icons.Trash;
const AlertTriangle = Icons.Warning;
const ArrowRight = Icons.ArrowRight;

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  roleLabel: "admin" | "therapist";
  openCases?: Array<{ id: string; caseNumber: string; status: string }>;
  onDelete: (params: { userId: string; confirmEmail: string }) => Promise<{
    success: boolean;
    error?: string;
    openCases?: Array<{ id: string; caseNumber: string; status: string }>;
  }>;
}

export function DeleteUserModal({
  isOpen,
  onClose,
  userId,
  userName,
  userEmail,
  roleLabel,
  openCases: initialOpenCases = [],
  onDelete,
}: DeleteUserModalProps) {
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [openCases, setOpenCases] = React.useState<Array<{ id: string; caseNumber: string; status: string }>>(
    initialOpenCases
  );
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setConfirmEmail("");
      setError(null);
      setOpenCases(initialOpenCases);
    }
  }, [isOpen]);

  const hasOpenCases = openCases.length > 0;
  const isEmailMatch = confirmEmail.trim().toLowerCase() === userEmail.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailMatch) {
      setError("Entered email does not match.");
      return;
    }
    if (hasOpenCases) {
      setError("Cannot delete therapist while open cases are assigned. Reassign them first.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await onDelete({ userId, confirmEmail: confirmEmail.trim() });
      if (!res.success) {
        setError(res.error ?? "Failed to delete user");
        if (res.openCases && res.openCases.length > 0) {
          setOpenCases(res.openCases);
        }
        setIsLoading(false);
        return;
      }

      onClose();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700 mb-2">
            <Trash2 className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center text-rose-950">
            Delete {roleLabel === "admin" ? "Administrator" : "Therapist"} Account
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            This will soft-delete <span className="font-semibold text-slate-800">{userName}</span>, immediately invalidate active sessions, and free up their email address for reuse.
          </DialogDescription>
        </DialogHeader>

        {hasOpenCases ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <p className="font-semibold">Cannot delete therapist with active cases</p>
                <p className="mt-0.5 text-amber-800">
                  This therapist currently has {openCases.length} open case{openCases.length === 1 ? "" : "s"} assigned. You must reassign all cases before deleting this account.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto space-y-2">
              <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Assigned Open Cases ({openCases.length})
              </div>
              <ul className="divide-y divide-slate-200 text-xs">
                {openCases.map((c) => (
                  <li key={c.id} className="py-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold font-mono text-slate-800">{c.caseNumber}</span>
                      <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {c.status.replace("_", " ")}
                      </span>
                    </div>
                    <Link
                      href={`/admin/cases/${c.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      <span>Reassign</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" type="button" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div
                data-testid="delete-error-message"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                To confirm deletion, please type the user&apos;s email address below:
              </p>
              <p className="font-mono font-semibold text-slate-900 mt-1 select-all">
                {userEmail}
              </p>
            </div>

            <Input
              data-testid="delete-confirm-email-input"
              label="Confirm Email Address"
              placeholder={userEmail}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              required
              autoFocus
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                data-testid="confirm-delete-user-button"
                type="submit"
                isLoading={isLoading}
                disabled={!isEmailMatch}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Account
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
