"use client";

import * as React from "react";
import { Check, Clock, AlertCircle, Calendar, ArrowRight, UserCheck, CheckCircle2, Plus } from "lucide-react";
import { formatDisplayDate, formatTimeIST, formatDateTimeIST } from "@/lib/date-utils";
import {
  SessionDetailDrawer,
  type TherapistSessionItem,
} from "@/components/dashboard/session-detail-drawer";
import { acceptCaseAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PendingCaseInvitation {
  id: string;
  caseNumber: string;
  clientName: string;
  priority: string;
  category: string;
}

interface TherapistDashboardClientProps {
  user: {
    id: string;
    name: string;
    role: string;
  };
  initialSessions: TherapistSessionItem[];
  roomNo: string | null;
  selectedDate: string; // YYYY-MM-DD
  isToday: boolean;
  isPast: boolean;
  pendingInvitations?: PendingCaseInvitation[];
  openCasesCount?: number;
  nextUpcomingSessionDate?: string | null;
}

export function TherapistDashboardClient({
  user,
  initialSessions,
  roomNo,
  selectedDate,
  isToday,
  isPast,
  pendingInvitations = [],
  openCasesCount = 0,
  nextUpcomingSessionDate = null,
}: TherapistDashboardClientProps) {
  const [sessions, setSessions] = React.useState<TherapistSessionItem[]>(initialSessions);
  const [selectedSession, setSelectedSession] = React.useState<TherapistSessionItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Keep state updated if initialSessions prop changes (e.g. date selector change)
  React.useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // Invitations handling for test compatibility
  const [invitations, setInvitations] = React.useState(pendingInvitations);
  const [acceptingId, setAcceptingId] = React.useState<string | null>(null);

  const handleAcceptInvitation = async (caseId: string) => {
    setAcceptingId(caseId);
    try {
      const res = await acceptCaseAction({ caseId });
      if (res.success) {
        setInvitations((prev) => prev.filter((c) => c.id !== caseId));
      }
    } catch (err) {
      console.error("Failed to accept invitation:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  // Compute live counts
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "held").length;
  const pendingSessions = totalSessions - completedSessions;
  const progressPercent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const handleOpenSession = (s: TherapistSessionItem) => {
    setSelectedSession(s);
    setDrawerOpen(true);
  };

  const handleSessionUpdated = (updated: TherapistSessionItem) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setSelectedSession(updated);
  };

  const formattedDate = formatDisplayDate(selectedDate);
  const assignedRoomDisplay = roomNo ? `Assigned Room: ${roomNo}` : "Room: Not assigned";

  return (
    <div className="space-y-6">
      {/* Read-Only History Banner for Past Dates */}
      {isPast && (
        <div
          data-testid="history-banner"
          className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-800 shadow-xs"
        >
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Viewing history (read-only):</strong> You are viewing session records for {formattedDate}. Past sessions cannot be edited.
          </span>
        </div>
      )}

      {/* Pending Case Invitations Banner (Compact alert when invitations are waiting) */}
      {invitations.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-5 w-5 text-teal-700 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-teal-900">
                  New Case Invitation{invitations.length > 1 ? "s" : ""}: You have {invitations.length} case{invitations.length > 1 ? "s" : ""} awaiting your acceptance.
                </p>
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      data-testid={`invitation-row-${inv.caseNumber}`}
                      className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-teal-200 text-xs text-slate-800"
                    >
                      <span className="font-mono font-semibold">{inv.caseNumber}</span>
                      <span>({inv.clientName})</span>
                      <Button
                        size="sm"
                        variant="primary"
                        data-testid="invitation-accept-button"
                        onClick={() => handleAcceptInvitation(inv.id)}
                        isLoading={acceptingId === inv.id}
                        className="ml-1"
                      >
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/therapist/cases">
              <Button variant="ghost" size="sm" showArrow>
                View All Cases
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Section A: Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Session Board
          </h1>
          <p
            data-testid="assigned-room-label"
            className="text-xs font-medium text-slate-600 mt-1"
          >
            {assignedRoomDisplay}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            data-testid="selected-date-display"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs"
          >
            <Calendar className="h-3.5 w-3.5 text-teal-700" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Legend & Thin Progress Bar */}
      {totalSessions > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span data-testid="session-board-legend">
              Pending: <strong className="text-rose-600 font-semibold">{pendingSessions}</strong> · Completed: <strong className="text-emerald-600 font-semibold">{completedSessions}</strong>
            </span>
            <span className="text-[11px] text-slate-500">
              {progressPercent}% Complete ({completedSessions}/{totalSessions})
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-emerald-600 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Section B: Session Grid */}
      {totalSessions === 0 ? (
        <div
          data-testid="no-sessions-empty-state"
          className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Calendar className="h-6 w-6" />
          </div>

          {isToday && openCasesCount > 0 ? (
            <div className="space-y-3 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-slate-900">
                No sessions today. You have {openCasesCount} open {openCasesCount === 1 ? "case" : "cases"}
              </h3>
              <p className="text-xs text-slate-500">
                You have active cases assigned to you. Schedule an appointment to populate today&apos;s session board.
              </p>
              {nextUpcomingSessionDate && (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 border border-teal-200">
                  <Clock className="h-3.5 w-3.5 text-teal-600" />
                  <span>
                    Next upcoming session:{" "}
                    <strong>{formatDateTimeIST(nextUpcomingSessionDate)}</strong>
                  </span>
                </div>
              )}
              <div className="pt-2">
                <Link
                  href="/therapist/cases"
                  data-testid="schedule-session-empty-button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-900 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Schedule a session</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">
                No sessions scheduled for this date
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                There are no appointments on {formattedDate}. Choose another date from the date selector in the top bar.
              </p>
              {nextUpcomingSessionDate && (
                <p className="mt-2 text-xs text-teal-700 font-medium">
                  Next upcoming session: {formatDateTimeIST(nextUpcomingSessionDate)}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="session-grid"
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
        >
          {sessions.map((session) => {
            const isHeld = session.status === "held";
            const inProgress = Boolean(session.inTimeAt && !isHeld);

            return (
              <button
                key={session.id}
                type="button"
                data-testid="session-block"
                data-session-id={session.id}
                data-status={isHeld ? "completed" : "pending"}
                onClick={() => handleOpenSession(session)}
                className={`group relative flex flex-col justify-between rounded-none p-4 text-left transition-all duration-150 select-none shadow-xs hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[96px] md:min-h-[110px] lg:min-h-[120px] ${
                  isHeld
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
                    : "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500"
                }`}
              >
                {/* Top line: Time & Status Icon */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="font-mono text-sm md:text-base font-bold tracking-tight">
                    {formatTimeIST(session.scheduledAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    {inProgress && (
                      <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                        In progress
                      </span>
                    )}
                    {isHeld ? (
                      <Check className="h-4 w-4 text-white/90 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-white/90 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Middle: Patient Name (Truncated) */}
                <div className="my-2 min-w-0 w-full">
                  <p className="text-xs md:text-sm font-semibold truncate leading-tight">
                    {session.patientName}
                  </p>
                  <p className="text-[10px] opacity-80 truncate font-mono">
                    {session.caseNumber}
                  </p>
                </div>

                {/* Bottom line: Text Label */}
                <div className="flex items-center justify-between text-[11px] font-medium opacity-90 w-full pt-1 border-t border-white/15">
                  <span>
                    {isHeld
                      ? "Completed"
                      : isPast
                      ? "Not completed"
                      : "Pending"}
                  </span>
                  <span className="text-[10px] opacity-75">
                    {roomNo || "No room"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Session Detail Drawer */}
      <SessionDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        session={selectedSession}
        roomNo={roomNo || "Room: Not assigned"}
        isToday={isToday}
        onSessionUpdated={handleSessionUpdated}
      />
    </div>
  );
}
