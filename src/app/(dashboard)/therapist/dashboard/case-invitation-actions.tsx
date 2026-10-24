"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { acceptCaseAction, declineCaseAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, AlertCircle } from "lucide-react";

interface CaseInvitationActionsProps {
  caseId: string;
}

export function CaseInvitationActions({ caseId }: CaseInvitationActionsProps) {
  const router = useRouter();
  const [isDeclining, setIsDeclining] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleAccept = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await acceptCaseAction({ caseId });
      if (!res.success) {
        setError(res.error ?? "Failed to accept case");
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (declineReason.trim().length < 10) {
      setError("Please provide a detailed decline reason (at least 10 characters).");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await declineCaseAction({
        caseId,
        reason: declineReason,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to decline case");
      } else {
        setIsDeclining(false);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isDeclining) {
    return (
      <form onSubmit={handleDeclineSubmit} className="space-y-3 mt-3 p-3 bg-rose-50/50 rounded-xl border border-rose-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-800">
            Decline Case Assignment
          </span>
          <button
            type="button"
            onClick={() => setIsDeclining(false)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>

        {error && (
          <p data-testid="invitation-error" className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}

        <Textarea
          placeholder="State reason for declining (e.g. outside clinical scope, scheduling conflict, etc.) — min 10 chars..."
          rows={2}
          data-testid="decline-reason-input"
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          required
        />

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDeclining(false)}
          >
            Back
          </Button>
          <Button
            type="submit"
            size="sm"
            data-testid="decline-submit-button"
            className="bg-rose-600 hover:bg-rose-700 text-white"
            isLoading={isLoading}
          >
            Confirm Decline
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
      {error && <span data-testid="invitation-error" className="text-xs text-rose-600">{error}</span>}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          data-testid="invitation-accept-button"
          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1"
          onClick={handleAccept}
          isLoading={isLoading}
        >
          <Check className="h-3.5 w-3.5" />
          <span>Accept</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="invitation-decline-button"
          className="h-8 px-3 text-xs text-rose-700 border-rose-200 hover:bg-rose-50 flex items-center gap-1"
          onClick={() => setIsDeclining(true)}
          disabled={isLoading}
        >
          <X className="h-3.5 w-3.5" />
          <span>Decline</span>
        </Button>
      </div>
    </div>
  );
}
