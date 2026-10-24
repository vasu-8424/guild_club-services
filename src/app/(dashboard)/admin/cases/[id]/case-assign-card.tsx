"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { assignCaseAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCheck, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface TherapistOption {
  id: string;
  name: string;
  specialization: string;
  openCases: number;
  maxOpenCases: number;
}

interface CaseAssignCardProps {
  caseId: string;
  currentTherapistId: string | null;
  currentTherapistName: string | null;
  isClosed: boolean;
  therapists: TherapistOption[];
}

export function CaseAssignCard({
  caseId,
  currentTherapistId,
  currentTherapistName,
  isClosed,
  therapists,
}: CaseAssignCardProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState(currentTherapistId || "");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const selectedTherapist = therapists.find((t) => t.id === selectedId);
  const isSelectedAtCapacity =
    selectedTherapist &&
    selectedTherapist.openCases >= selectedTherapist.maxOpenCases;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError("Please select a therapist to assign.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await assignCaseAction({
        caseId,
        therapistId: selectedId,
        notes: notes || undefined,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to assign case");
      } else {
        setSuccess("Case successfully assigned to therapist.");
        setNotes("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Therapist Assignment</CardTitle>
          </div>
        </div>
        <CardDescription className="text-xs">
          {currentTherapistName ? (
            <span>
              Currently assigned to: <strong>{currentTherapistName}</strong>
            </span>
          ) : (
            <span className="text-amber-700 font-medium">
              Currently unassigned. Assign a practitioner below.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {isClosed ? (
          <p className="text-xs text-slate-500 italic">
            This case is closed. Therapist assignments cannot be changed.
          </p>
        ) : (
          <form onSubmit={handleAssign} className="space-y-4">
            {error && (
              <div data-testid="assign-error-message" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div data-testid="assign-success-message" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <Select
              data-testid="assign-therapist-select"
              label="Select Practitioner"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
            >
              <option value="">-- Choose a therapist --</option>
              {therapists.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.name} — {th.specialization} ({th.openCases}/{th.maxOpenCases} cases)
                </option>
              ))}
            </Select>

            {isSelectedAtCapacity && (
              <div data-testid="assign-capacity-warning" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Capacity Notice:</strong> {selectedTherapist?.name} has reached maximum case capacity ({selectedTherapist?.openCases}/{selectedTherapist?.maxOpenCases}). Assignment is still permitted.
                </span>
              </div>
            )}

            <Textarea
              data-testid="assign-notes-input"
              label="Assignment Directive / Notes (Optional)"
              placeholder="Instructions or triage directives for the assigned practitioner..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <Button data-testid="assign-submit-button" type="submit" size="sm" isLoading={isLoading}>
              {currentTherapistId ? "Reassign Case" : "Assign Case"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
