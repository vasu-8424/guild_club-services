"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { SendNoteDialog } from "@/components/admin/send-note-dialog";
import { getServiceLabel } from "@/lib/services";
import type { FormattedLoginRecord } from "@/lib/actions/location-actions";

export interface DaySessionMetric {
  dateStr: string; // YYYY-MM-DD
  formattedDate: string; // "26 Oct 2026, Monday"
  sessionsDone: number;
  casesClosed: number;
  newCases: number;
}

export interface TherapistActiveCaseItem {
  id: string;
  caseNumber: string;
  patientId: string;
  patientName: string;
  service: string;
  branchName: string;
  roomNo: string;
  startDate: string;
  sessionsDone: number;
  lastSessionDate: string;
}

export interface TherapistNoteSentItem {
  id: string;
  message: string;
  createdAt: string;
  formattedCreatedAt: string;
  readAt: string | null;
  formattedReadAt: string | null;
  isRead: boolean;
}

interface TherapistDetailClientProps {
  therapist: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    lastLogin: string;
  };
  dailyMetrics: DaySessionMetric[];
  activeCases: TherapistActiveCaseItem[];
  notesSent: TherapistNoteSentItem[];
  loginRecords: FormattedLoginRecord[];
  monthOptions: Array<{ value: string; label: string }>;
  currentMonth: string;
}

export function TherapistDetailClient({
  therapist,
  dailyMetrics,
  activeCases,
  notesSent,
  loginRecords,
  monthOptions,
  currentMonth,
}: TherapistDetailClientProps) {
  const router = useRouter();
  const [showSendNote, setShowSendNote] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);

  // Month change triggers URL navigation
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    window.location.search = `?month=${newMonth}`;
  };

  // Month totals
  const monthTotals = React.useMemo(() => {
    return dailyMetrics.reduce(
      (acc, d) => {
        acc.sessions += d.sessionsDone;
        acc.closed += d.casesClosed;
        acc.newCases += d.newCases;
        return acc;
      },
      { sessions: 0, closed: 0, newCases: 0 }
    );
  }, [dailyMetrics]);

  return (
    <div className="space-y-8" data-testid="therapist-detail-page">
      {/* 1. Header */}
      <div className="border border-slate-200 bg-white p-6 shadow-xs rounded-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">
                {therapist.name}
              </h1>
              {therapist.isActive ? (
                <span
                  data-testid="therapist-status-badge"
                  className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider rounded-none"
                >
                  ACTIVE
                </span>
              ) : (
                <span
                  data-testid="therapist-status-badge"
                  className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider rounded-none"
                >
                  INACTIVE
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono">
              <span className="flex items-center gap-1.5">
                <Icons.Envelope className="h-3.5 w-3.5 text-slate-400" />
                {therapist.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Icons.Phone className="h-3.5 w-3.5 text-slate-400" />
                {therapist.phone || "No phone registered"}
              </span>
              <span className="flex items-center gap-1.5">
                <Icons.Clock className="h-3.5 w-3.5 text-slate-400" />
                Last login: <strong className="text-slate-800">{therapist.lastLogin}</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons: Send note and Edit */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Icons.Envelope />}
              onClick={() => setShowSendNote(true)}
              data-testid="send-note-header-btn"
            >
              Send note
            </Button>
            <Link href={`/admin/therapists/${therapist.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Icons.PencilSimple />}
                data-testid="edit-therapist-header-btn"
              >
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Section: Sessions per day (NO CHART, plain table) */}
      <div className="border border-slate-200 bg-white p-6 shadow-xs rounded-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Sessions per Day
            </h2>
            <p className="text-xs text-slate-500">
              Daily clinical throughput, case conclusions, and patient admissions.
            </p>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="month-select"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider"
            >
              Month:
            </label>
            <select
              id="month-select"
              data-testid="month-selector"
              data-test="month-select"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border border-slate-300 px-3 py-1.5 text-xs text-slate-800 font-semibold rounded-none bg-white focus:outline-none focus:border-[#0B7A63]"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            data-testid="sessions-per-day-table"
            className="w-full block text-left text-xs border-collapse divide-y divide-slate-100"
          >
            <thead className="sr-only">
              <tr>
                <th>Date</th>
                <th>Sessions done</th>
                <th>Cases closed</th>
                <th>New cases</th>
              </tr>
            </thead>
            <tbody className="block divide-y divide-slate-200 font-sans text-slate-800">
              {dailyMetrics.map((day) => (
                <tr
                  key={day.dateStr}
                  data-testid={`session-day-row-${day.dateStr}`}
                  className="block p-3.5 space-y-1.5 hover:bg-slate-50 transition-colors"
                >
                  <td className="flex items-center justify-between font-mono font-bold text-slate-900">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans">Date</span>
                    <span>{day.formattedDate}</span>
                  </td>
                  <td className="flex items-center justify-between font-mono">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans">Sessions</span>
                    {day.sessionsDone === 0 ? (
                      <span className="text-red-600 font-bold" data-testid="zero-sessions">
                        0
                      </span>
                    ) : (
                      <span className="text-slate-900 font-bold">{day.sessionsDone}</span>
                    )}
                  </td>
                  <td className="flex items-center justify-between font-mono text-slate-700">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans">Closed</span>
                    <span>{day.casesClosed}</span>
                  </td>
                  <td className="flex items-center justify-between font-mono text-slate-700">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans">New Cases</span>
                    <span>{day.newCases}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total Row */}
            <tfoot className="block bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900 p-3.5">
              <tr
                data-testid="month-totals-row"
                data-test-totals="daily-sessions-totals-row"
                className="block space-y-1"
              >
                <td className="block uppercase text-xs tracking-wider mb-1 text-slate-700">
                  Total for Month
                </td>
                <td className="flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-600 font-medium">Total Sessions:</span>
                  <span>{monthTotals.sessions}</span>
                </td>
                <td className="flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-600 font-medium">Total Closed:</span>
                  <span>{monthTotals.closed}</span>
                </td>
                <td className="flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-600 font-medium">Total New Cases:</span>
                  <span>{monthTotals.newCases}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. Section: Active Cases */}
      <div className="border border-slate-200 bg-white p-6 shadow-xs rounded-none space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Active Cases ({activeCases.length})
          </h2>
          <p className="text-xs text-slate-500">
            Ongoing clinical care and assigned treatment rooms under this practitioner.
          </p>
        </div>

        {activeCases.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No open cases currently assigned to this practitioner.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="therapist-active-cases-table"
              className="w-full block text-left text-xs border-collapse divide-y divide-slate-100"
            >
              <thead className="sr-only">
                <tr>
                  <th>Patient ID</th>
                  <th>Patient name</th>
                  <th>Service</th>
                  <th>Branch</th>
                  <th>Room</th>
                  <th>Start date</th>
                  <th>Sessions done</th>
                  <th>Last session date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-slate-200 font-sans text-slate-800">
                {activeCases.map((c) => (
                  <tr
                    key={c.id}
                    data-testid={`active-case-row-${c.id}`}
                    className="block p-3.5 space-y-2 hover:bg-slate-50 transition-colors"
                  >
                    <td className="flex items-center justify-between font-mono font-bold text-slate-900">
                      <span className="text-[#0B7A63]">{c.patientId}</span>
                      <span className="font-sans font-semibold text-slate-800">{c.patientName}</span>
                    </td>
                    <td className="flex items-center justify-between text-slate-600">
                      <span>{getServiceLabel(c.service)}</span>
                      <span>Room {c.roomNo}</span>
                    </td>
                    <td className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                      <span>Branch: {c.branchName}</span>
                      <span>Sessions: {c.sessionsDone}</span>
                    </td>
                    <td className="pt-2 border-t border-slate-100 flex justify-end">
                      <Link
                        href={`/admin/cases/${c.id}`}
                        className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#0B7A63] border border-[#0B7A63] hover:bg-[#0B7A63] hover:text-white transition-colors"
                      >
                        View case details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Section: Notes Sent */}
      <div className="border border-slate-200 bg-white p-6 shadow-xs rounded-none space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Notes Sent ({notesSent.length})
            </h2>
            <p className="text-xs text-slate-500">
              Record of administrative notes transmitted to this therapist.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icons.Plus />}
            onClick={() => setShowSendNote(true)}
          >
            Send New Note
          </Button>
        </div>

        {notesSent.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No notes sent to this therapist yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="notes-sent-table"
              className="w-full text-left text-xs border-collapse"
            >
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-semibold">
                  <th className="py-2.5 px-4 w-44">Date & Time</th>
                  <th className="py-2.5 px-4">Note Text</th>
                  <th className="py-2.5 px-4 w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
                {notesSent.map((n) => (
                  <tr
                    key={n.id}
                    data-testid={`note-sent-row-${n.id}`}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {n.formattedCreatedAt}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 font-sans whitespace-pre-wrap">
                      {n.message}
                    </td>
                    <td className="py-2.5 px-4">
                      {n.isRead ? (
                        <span
                          data-testid="note-seen-tag"
                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider rounded-none"
                          title={n.formattedReadAt ? `Seen at ${n.formattedReadAt}` : "Seen"}
                        >
                          Seen {n.formattedReadAt ? `(${n.formattedReadAt})` : ""}
                        </span>
                      ) : (
                        <span
                          data-testid="note-not-seen-tag"
                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider rounded-none"
                        >
                          Not seen
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Section: Login Activity (unchanged existing table) */}
      <div className="border border-slate-200 bg-white p-6 shadow-xs rounded-none space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Login Activity
          </h2>
          <p className="text-xs text-slate-500">
            Audit log of geographic location, IP, and authentication timestamps.
          </p>
        </div>

        {loginRecords.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No login history recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="therapist-login-activity-table"
              className="w-full text-left text-xs border-collapse"
            >
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-semibold">
                  <th className="py-2.5 px-3">Login Time (IST)</th>
                  <th className="py-2.5 px-3">Logout Time (IST)</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Location Status</th>
                  <th className="py-2.5 px-3">Accuracy</th>
                  <th className="py-2.5 px-3">Map Location</th>
                  <th className="py-2.5 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
                {loginRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      {rec.formattedLoggedInAt}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {rec.formattedLoggedOutAt ? (
                        rec.formattedLoggedOutAt
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Active session
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {rec.duration || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      {rec.locationStatus === "captured" ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider rounded-none">
                          Captured
                        </span>
                      ) : rec.locationStatus === "denied" ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 uppercase tracking-wider rounded-none">
                          Denied
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider rounded-none">
                          Unavailable
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {rec.accuracyMeters !== null
                        ? `±${rec.accuracyMeters} m`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      {rec.mapUrl ? (
                        <a
                          href={rec.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0B7A63] hover:underline font-bold"
                        >
                          Open in map &rarr;
                        </a>
                      ) : (
                        <span className="text-slate-400">No coordinates</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">
                      {rec.ipAddress || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Note Dialog */}
      <SendNoteDialog
        isOpen={showSendNote}
        onClose={() => setShowSendNote(false)}
        therapistId={therapist.id}
        therapistName={therapist.name}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
