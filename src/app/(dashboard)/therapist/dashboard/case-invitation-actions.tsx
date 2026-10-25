"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { acceptCaseAction, declineCaseAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, AlertCircle } from "lucide-react";
import { Icons } from "@/components/ui/icons";

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
      <form onSubmit={handleDeclineSubmit} className="space-y-3 mt-3 p-3 bg-rose-50/50 rounded-none border border-rose-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-800">
            Decline Case Assignment
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDeclining(false)}
          >
            Cancel
          </Button>
        </div>

        {error && (
          <p data-testid="invitation-error" className="text-xs text-rose-600 flex items-center gap-1">
            <Icons.Alert className="h-3 w-3 shrink-0" />
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
            variant="secondary"
            size="sm"
            onClick={() => setIsDeclining(false)}
          >
            Back
          </Button>
          <Button
            type="submit"
            size="sm"
            data-testid="decline-submit-button"
            variant="destructive"
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
          variant="primary"
          data-testid="invitation-accept-button"
          onClick={handleAccept}
          isLoading={isLoading}
          leadingIcon={<Icons.Check />}
        >
          Accept
        </Button>
        <Button
          variant="destructive-outline"
          size="sm"
          data-testid="invitation-decline-button"
          onClick={() => setIsDeclining(true)}
          disabled={isLoading}
          leadingIcon={<Icons.X />}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
