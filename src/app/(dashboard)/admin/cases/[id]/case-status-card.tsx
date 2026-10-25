"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateCaseStatusAction, closeCaseAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Activity, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { Icons } from "@/components/ui/icons";
import type { CaseStatus, CaseOutcome } from "@/db/schema";

interface CaseStatusCardProps {
  caseId: string;
  currentStatus: CaseStatus;
  currentOutcome: CaseOutcome | null;
  closedAt: Date | null;
  userRole: "therapist" | "admin" | "super_admin";
}

export function CaseStatusCard({
  caseId,
  currentStatus,
  currentOutcome,
  closedAt,
  userRole,
}: CaseStatusCardProps) {
  const router = useRouter();
  const isClosed = currentStatus === "completed";

  // Status update state
  const [newStatus, setNewStatus] = React.useState<CaseStatus>(currentStatus);
  const [statusNotes, setStatusNotes] = React.useState("");
  const [statusLoading, setStatusLoading] = React.useState(false);

  // Close case state
  const [outcome, setOutcome] = React.useState<CaseOutcome>("successful");
  const [closingNotes, setClosingNotes] = React.useState("");
  const [closeLoading, setCloseLoading] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setStatusLoading(true);

    try {
      const res = await updateCaseStatusAction({
        caseId,
        status: newStatus,
        notes: statusNotes || undefined,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to update status");
      } else {
        setSuccess(`Case status updated to '${newStatus}'.`);
        setStatusNotes("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCloseCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Are you sure you want to close this case with outcome '${outcome}'?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setCloseLoading(true);

    try {
      const res = await closeCaseAction({
        caseId,
        outcome,
        closingNotes: closingNotes || undefined,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to close case");
      } else {
        setSuccess("Case closed successfully.");
        setClosingNotes("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Case Workflow Status</CardTitle>
          </div>
          <StatusBadge status={currentStatus} />
        </div>
        <CardDescription className="text-xs">
          {isClosed
            ? `Closed on ${closedAt ? new Date(closedAt).toLocaleDateString() : "—"} with outcome: ${currentOutcome?.toUpperCase()}`
            : "Update case lifecycle progression or finalize discharge."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {error && (
          <div data-testid="case-status-error-message" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div data-testid="case-status-success-message" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {!isClosed ? (
          <>
            {/* Update Status */}
            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Advance Case Status
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  data-testid="case-status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                >
                  <option value="new">New</option>
                  <option value="assigned">Assigned</option>
                  <option value="accepted">Accepted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                </Select>

                <Input
                  data-testid="case-status-notes-input"
                  placeholder="Optional transition note..."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                />
              </div>

              <Button
                data-testid="case-status-submit-button"
                type="submit"
                size="sm"
                variant="outline"
                isLoading={statusLoading}
                disabled={newStatus === currentStatus}
              >
                Update Status
              </Button>
            </form>

            {/* Close Case Section */}
            <div className="pt-4 border-t border-slate-100">
              <form onSubmit={handleCloseCase} className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-700">
                  <XCircle className="h-4 w-4" />
                  <span>Finalize & Close Case</span>
                </div>
                <p className="text-xs text-slate-500">
                  Closing a case marks it as completed, records the clinical outcome, and queues notification emails.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    data-testid="case-outcome-select"
                    label="Clinical Outcome"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as CaseOutcome)}
                    required
                  >
                    <option value="successful">Successful Treatment / Goal Met</option>
                    <option value="unsuccessful">Unsuccessful / Dropped Out</option>
                    <option value="referred">Referred to Specialist / External Care</option>
                  </Select>

                  <Input
                    data-testid="case-closing-notes-input"
                    label="Closing Summary (Optional)"
                    placeholder="Discharge summary or final remarks..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                  />
                </div>

                <Button
                  data-testid="case-close-submit-button"
                  type="submit"
                  size="sm"
                  variant="destructive"
                  leadingIcon={<Icons.Check />}
                  isLoading={closeLoading}
                >
                  Close Case & Discharge
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p>
              This case is archived in <strong>Completed</strong> status. Outcome:{" "}
              <strong className="uppercase">{currentOutcome}</strong>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
