"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { scheduleSessionAction, updateSessionStatusAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Check, X, AlertCircle, Clock } from "lucide-react";
import type { SessionStatus } from "@/db/schema";

interface SessionItem {
  id: string;
  scheduledAt: Date;
  status: SessionStatus;
  notes: string | null;
  therapistName: string;
  inTimeAt?: Date | null;
  inTimePhotoKey?: string | null;
  outTimeAt?: Date | null;
  outTimePhotoKey?: string | null;
  workDone?: string | null;
  patientSignatureKey?: string | null;
  completedAt?: Date | null;
  roomNo?: string | null;
}

interface CaseSessionsCardProps {
  caseId: string;
  hasTherapist: boolean;
  sessions: SessionItem[];
  patientName?: string;
  therapists?: { id: string; name: string }[];
  defaultTherapistId?: string | null;
  userRole?: string;
}

export function CaseSessionsCard({
  caseId,
  hasTherapist,
  sessions,
  patientName,
  therapists = [],
  defaultTherapistId = null,
  userRole,
}: CaseSessionsCardProps) {
  const router = useRouter();

  // Schedule session state
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [notes, setNotes] = React.useState("");
  const [roomNo, setRoomNo] = React.useState("");
  const [selectedTherapistId, setSelectedTherapistId] = React.useState(
    defaultTherapistId || (therapists[0]?.id ?? "")
  );
  const [scheduleLoading, setScheduleLoading] = React.useState(false);

  // Status update state
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      setError("Please choose a date and time for the session.");
      return;
    }

    setError(null);
    setSuccess(null);
    setScheduleLoading(true);

    try {
      const res = await scheduleSessionAction({
        caseId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        notes: notes || undefined,
        therapistId: selectedTherapistId || undefined,
        roomNo: roomNo.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to schedule session");
      } else {
        setSuccess("Session scheduled successfully.");
        setScheduledAt("");
        setNotes("");
        setRoomNo("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleUpdateStatus = async (
    sessionId: string,
    status: "held" | "missed" | "cancelled"
  ) => {
    setUpdatingId(sessionId);
    setError(null);
    setSuccess(null);

    try {
      const res = await updateSessionStatusAction({
        sessionId,
        status,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to update session status");
      } else {
        setSuccess(`Session marked as ${status}.`);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const renderSessionBadge = (status: SessionStatus) => {
    switch (status) {
      case "held":
        return <Badge variant="success">Held</Badge>;
      case "missed":
        return <Badge variant="danger">Missed</Badge>;
      case "cancelled":
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
            Scheduled
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Therapy Sessions</CardTitle>
          </div>
          <span className="text-xs text-slate-500">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </span>
        </div>
        <CardDescription className="text-xs">
          Schedule therapy appointments and record attendance outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {error && (
          <div data-testid="session-error-message" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div data-testid="session-success-message" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Sessions list */}
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No sessions scheduled for this case yet.
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                data-testid="session-item"
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">
                        {new Date(s.scheduledAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      {renderSessionBadge(s.status)}
                      {s.roomNo && (
                        <span className="bg-teal-50 text-teal-800 border border-teal-200 rounded px-2 py-0.5 text-[10px] font-medium">
                          {s.roomNo}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Therapist: <strong className="text-slate-700 font-semibold">{s.therapistName}</strong>
                      {patientName && ` · Patient: ${patientName}`}
                      {s.notes && ` — "${s.notes}"`}
                    </p>
                  </div>

                  {s.status === "scheduled" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        data-testid="session-held-button"
                        leadingIcon={<Check className="text-emerald-600" />}
                        onClick={() => handleUpdateStatus(s.id, "held")}
                        isLoading={updatingId === s.id}
                      >
                        Held
                      </Button>
                      <Button
                        variant="warning-outline"
                        size="sm"
                        data-testid="session-missed-button"
                        onClick={() => handleUpdateStatus(s.id, "missed")}
                        isLoading={updatingId === s.id}
                      >
                        Missed
                      </Button>
                      <Button
                        variant="destructive-outline"
                        size="sm"
                        data-testid="session-cancelled-button"
                        leadingIcon={<X className="text-rose-600" />}
                        onClick={() => handleUpdateStatus(s.id, "cancelled")}
                        isLoading={updatingId === s.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Read-Only Clinical Session Details (Photos, Work Done, Signature, Room) */}
                {(s.inTimePhotoKey || s.outTimePhotoKey || s.workDone || s.patientSignatureKey) && (
                  <div className="mt-2 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-100">
                    {/* Photos */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Session Proof Photos
                      </span>
                      <div className="flex gap-2">
                        {s.inTimePhotoKey && (
                          <div className="relative rounded border border-slate-200 overflow-hidden w-20 h-16 bg-slate-50 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/${s.id}/in-time-photo`}
                              alt="In-time proof"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center">
                              In
                            </span>
                          </div>
                        )}
                        {s.outTimePhotoKey && (
                          <div className="relative rounded border border-slate-200 overflow-hidden w-20 h-16 bg-slate-50 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/${s.id}/out-time-photo`}
                              alt="Out-time proof"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center">
                              Out
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Work Done */}
                    {s.workDone && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Work Done
                        </span>
                        <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap max-h-20 overflow-y-auto">
                          {s.workDone}
                        </p>
                      </div>
                    )}

                    {/* Patient Signature */}
                    {s.patientSignatureKey && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Patient Signature
                        </span>
                        <div className="rounded border border-slate-200 bg-white p-1 max-h-16 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/files/${s.id}/signature`}
                            alt="Patient sign"
                            className="max-h-14 object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Schedule session form */}
        {hasTherapist ? (
          <form onSubmit={handleSchedule} className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              <span>Schedule Next Session</span>
            </h4>

            {therapists.length > 0 && (
              <Select
                label="Assign Therapist"
                data-testid="session-therapist-select"
                value={selectedTherapistId}
                onChange={(e) => setSelectedTherapistId(e.target.value)}
                options={[
                  { value: "", label: "Select therapist..." },
                  ...therapists.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Date & Time"
                type="datetime-local"
                data-testid="session-date-input"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />

              <Input
                label="Duration (Minutes)"
                type="number"
                min={15}
                max={180}
                data-testid="session-duration-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Session Focus / Agenda (Optional)"
                placeholder="e.g. Cognitive restructuring review"
                data-testid="session-notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <Input
                label="Room (Optional)"
                placeholder="e.g. Room 204"
                data-testid="session-room-input"
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              size="sm"
              data-testid="session-submit-button"
              isLoading={scheduleLoading}
              leadingIcon={<Plus />}
            >
              Schedule Session
            </Button>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
            Please assign a therapist before scheduling sessions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
