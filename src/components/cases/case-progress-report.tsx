"use client";

import React from "react";
import Link from "next/link";
import { getServiceLabel, getOutcomeLabel } from "@/lib/services";
import { formatDisplayDate, formatDateTimeIST } from "@/lib/date-utils";
import { Printer, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { SessionsPerWeekChart } from "@/components/charts/sessions-per-week-chart";

export interface SubmittedReportViewItem {
  id: string;
  reportType: "update" | "final";
  reportDate: string;
  currentCondition: string;
  progressText: string;
  treatmentPlan: string | null;
  remarks: string | null;
  submittedAt: Date | string | null;
  authorName: string;
  isEdited: boolean;
}

export interface ProgressReportData {
  caseId: string;
  patientId: string;
  caseNumber: string;
  patientName: string;
  age: number;
  sex: string;
  service: string;
  problem: string;
  startingCondition: string;
  presentCondition: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null
  isClosed: boolean;
  branchName: string;
  roomNo: string;
  therapistName: string;
  outcome: string | null;
  closingSummary: string | null;
  totalDays: number;
  sessionsDone: number;
  missedDays: number;
  attendancePct: number;
  joiningPhotoUrl: string | null;
  joiningPhotoDate: string | null;
  presentPhotoUrl: string | null;
  presentPhotoDate: string | null;
  sessionNotes: Array<{
    date: string;
    note: string;
  }>;
  submittedReports: SubmittedReportViewItem[];
  isOwner?: boolean;
  backUrl?: string;
  printDate?: string;
}

export function CaseProgressReport({ data }: { data: ProgressReportData }) {
  const handlePrint = () => {
    window.print();
  };

  const serviceLabel = getServiceLabel(data.service);
  const outcomeLabel = getOutcomeLabel(data.outcome);
  const backHref = data.backUrl || `/therapist/cases/${data.caseId}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12" data-testid="progress-report-view">
      {/* Top action bar (hidden on print) */}
      <div className="no-print flex items-center justify-between border-b border-stone-200 pb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Case</span>
        </Link>

        <button
          type="button"
          data-testid="download-pdf-btn"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-[#0B7A63] hover:bg-[#096350] text-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none shadow-xs transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Download PDF</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="report-sheet bg-white border border-stone-300 p-8 shadow-sm rounded-none text-stone-900 print:border-0 print:p-0 print:shadow-none">
        {/* a) Header: Patient ID, patient name, age, sex, service, problem, branch, room, start date, end date or "Ongoing", and status. */}
        <div className="page-break-avoid mb-6">
          <div className="flex items-start justify-between border-b-2 border-stone-900 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight uppercase text-stone-900">
                  Guild Club Services
                </span>
                <span className="text-xs bg-[#0B7A63] text-white px-2 py-0.5 font-semibold uppercase tracking-wider">
                  Clinical Progress Report
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Patient Rehabilitation & Clinical Assessment
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-stone-500 block uppercase font-bold tracking-wider">
                Patient ID
              </span>
              <span
                data-testid="report-patient-id"
                className="text-2xl font-mono font-bold text-[#0B7A63]"
              >
                {data.patientId}
              </span>
              <span className="text-[11px] text-stone-400 block font-mono">
                Ref: {data.caseNumber}
              </span>
            </div>
          </div>

          {/* Demographics and Case Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 border border-stone-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Patient Name
              </span>
              <span className="font-semibold text-stone-900" data-testid="report-patient-name">
                {data.patientName}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Age & Sex
              </span>
              <span className="font-semibold text-stone-900 capitalize">
                {data.age} yrs / {data.sex}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Service
              </span>
              <span className="font-semibold text-[#0B7A63]">
                {serviceLabel}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Therapist
              </span>
              <span className="font-semibold text-stone-900">
                {data.therapistName}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Branch & Room
              </span>
              <span className="font-semibold text-stone-900">
                {data.branchName} — {data.roomNo}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Start Date
              </span>
              <span className="font-semibold text-stone-900">
                {formatDisplayDate(data.startDate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                End Date
              </span>
              <span className="font-semibold text-stone-900">
                {data.endDate ? formatDisplayDate(data.endDate) : "Ongoing"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Status
              </span>
              <span className={`font-bold uppercase ${data.isClosed ? "text-stone-700" : "text-emerald-700"}`}>
                {data.isClosed ? "Discharged / Closed" : "Active Treatment"}
              </span>
            </div>
          </div>

          {/* Problem Statement */}
          <div className="mt-3 border-l-3 border-[#0B7A63] pl-3 py-1.5 bg-emerald-50/40">
            <span className="text-[10px] uppercase font-bold text-stone-500 block">
              Primary Problem / Clinical Complaint
            </span>
            <p className="text-xs text-stone-800 font-medium">
              {data.problem}
            </p>
          </div>
        </div>

        {/* b) Facts strip (system-calculated numbers only): sessions done, missed days, attendance %. */}
        <div className="page-break-avoid mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border border-emerald-200 bg-emerald-50/50 p-3">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                Sessions Done
              </span>
              <span className="text-xl font-mono font-bold text-emerald-800" data-testid="report-sessions-done">
                {data.sessionsDone}
              </span>
            </div>
            <div className="border border-red-200 bg-red-50/50 p-3">
              <span className="text-[10px] uppercase font-bold text-red-800 block">
                Missed Days
              </span>
              <span className="text-xl font-mono font-bold text-red-800">
                {data.missedDays}
              </span>
            </div>
            <div className="border border-stone-200 bg-stone-50/50 p-3">
              <span className="text-[10px] uppercase font-bold text-stone-500 block">
                Attendance %
              </span>
              <span className="text-xl font-mono font-bold text-stone-900" data-testid="report-attendance-pct">
                {data.attendancePct}%
              </span>
            </div>
          </div>

          <SessionsPerWeekChart
            startDate={data.startDate}
            endDate={data.endDate}
            sessionDates={data.sessionNotes.map((n) => n.date)}
          />
        </div>

        {/* c) Photos: joining condition and, once closed, present condition, side by side with their dates. */}
        <div className="page-break-avoid mb-6 border border-stone-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-4 pb-1 border-b border-stone-100">
            Clinical Visual Progression (Photos)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Joining Condition */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-stone-800">Joining Condition Photo</span>
                <span className="text-[11px] text-stone-500 font-mono">
                  {data.joiningPhotoDate ? formatDisplayDate(data.joiningPhotoDate) : formatDisplayDate(data.startDate)}
                </span>
              </div>
              <div className="border border-stone-300 bg-stone-100 h-64 flex items-center justify-center overflow-hidden">
                {data.joiningPhotoUrl ? (
                  <img
                    data-testid="joining-photo"
                    src={data.joiningPhotoUrl}
                    alt="Joining condition"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-stone-400 italic">No joining photo recorded</span>
                )}
              </div>
              <div className="text-xs text-stone-700 bg-stone-50 p-2 border border-stone-200">
                <strong className="block text-[10px] uppercase text-stone-400">
                  Initial Condition:
                </strong>
                {data.startingCondition}
              </div>
            </div>

            {/* Present Condition */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-stone-800">Present Condition Photo</span>
                <span className="text-[11px] text-stone-500 font-mono">
                  {data.presentPhotoDate
                    ? formatDisplayDate(data.presentPhotoDate)
                    : data.endDate
                    ? formatDisplayDate(data.endDate)
                    : "Ongoing"}
                </span>
              </div>
              <div className="border border-stone-300 bg-stone-100 h-64 flex items-center justify-center overflow-hidden">
                {data.presentPhotoUrl ? (
                  <img
                    data-testid="present-photo"
                    src={data.presentPhotoUrl}
                    alt="Present condition"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-stone-400 italic">
                    {data.isClosed
                      ? "No present photo uploaded"
                      : "Ongoing — Discharged photo captured upon closing case"}
                  </span>
                )}
              </div>
              <div className="text-xs text-stone-700 bg-stone-50 p-2 border border-stone-200">
                <strong className="block text-[10px] uppercase text-stone-400">
                  Current / Discharge Condition:
                </strong>
                {data.presentCondition || "Active therapy course in progress."}
              </div>
            </div>
          </div>
        </div>

        {/* d) "Therapist's report": every submitted report in date order, showing the therapist's exact words, the date and time, the type tag, and the writer's name. Preserve line breaks. Show "(edited)" when a version exists. */}
        <div data-testid="therapist-report-section" className="page-break-avoid mb-6 border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-4 pb-1 border-b border-stone-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Therapist&apos;s Report ({data.submittedReports.length} Submitted)
            </h3>
            <span className="text-[10px] text-stone-400 uppercase font-semibold">
              Chronological Clinical Entries
            </span>
          </div>

          {data.submittedReports.length === 0 ? (
            <div
              data-testid="no-reports-empty"
              className="border border-dashed border-stone-300 bg-stone-50/60 p-8 text-center space-y-3"
            >
              <FileText className="w-8 h-8 text-stone-400 mx-auto stroke-1" />
              <p className="text-xs font-semibold text-stone-700">
                No progress report has been written yet
              </p>
              <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                The therapist records clinical progress updates during active treatment and a final summary upon closing.
              </p>
              {data.isOwner && !data.isClosed && (
                <div className="pt-2 no-print">
                  <Link
                    href={`/therapist/cases/${data.caseId}?tab=progress-report`}
                    data-testid="write-report-btn"
                    className="inline-flex items-center gap-1.5 bg-[#0B7A63] hover:bg-[#096350] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none shadow-xs transition-colors"
                  >
                    Write report
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {data.submittedReports.map((report, idx) => {
                const isFinal = report.reportType === "final";
                return (
                  <div
                    key={report.id}
                    data-testid="submitted-report-card"
                    className="border border-stone-200 bg-stone-50/40 p-4 space-y-3 page-break-avoid"
                  >
                    {/* Header of Report Card */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isFinal
                              ? "bg-stone-900 text-white"
                              : "bg-[#0B7A63] text-white"
                          }`}
                        >
                          {isFinal ? "Final Report" : "Progress Update"}
                        </span>
                        <span className="text-xs font-mono font-semibold text-stone-800">
                          {formatDisplayDate(report.reportDate)}
                        </span>
                        {report.isEdited && (
                          <span
                            data-testid="report-edited-badge"
                            className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 font-medium"
                          >
                            (edited)
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-stone-500">
                        <span>By <strong className="text-stone-800">{report.authorName}</strong></span>
                        {report.submittedAt && (
                          <span className="ml-2 font-mono text-[10px] text-stone-400">
                            • {formatDateTimeIST(report.submittedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Report Text: Current Condition */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                        Current Condition of Patient
                      </span>
                      <div className="text-xs text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                        {report.currentCondition}
                      </div>
                    </div>

                    {/* Report Text: Progress Since Last Report */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                        Progress Since Last Report
                      </span>
                      <div className="text-xs text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                        {report.progressText}
                      </div>
                    </div>

                    {/* Report Text: Treatment Given & Plan (if present) */}
                    {report.treatmentPlan && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                          Treatment Given & Plan Ahead
                        </span>
                        <div className="text-xs text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {report.treatmentPlan}
                        </div>
                      </div>
                    )}

                    {/* Report Text: Remarks (if present) */}
                    {report.remarks && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                          Remarks
                        </span>
                        <div className="text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed italic">
                          {report.remarks}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* e) Session notes timeline (the daily notes already recorded). */}
        <div data-testid="notes-timeline" className="page-break-avoid mb-6 border border-stone-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3 pb-1 border-b border-stone-100">
            Session Notes Timeline ({data.sessionNotes.length} Recorded)
          </h3>

          {data.sessionNotes.length === 0 ? (
            <p className="text-xs text-stone-400 italic py-2">
              No session notes recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {data.sessionNotes.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-start gap-2 border-b border-stone-100 pb-2 last:border-0"
                >
                  <span className="font-mono font-semibold text-stone-700 w-28 shrink-0">
                    {formatDisplayDate(item.date)}
                  </span>
                  <p className="text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* f) Outcome and closing summary (if closed). */}
        {data.isClosed && (
          <div className="page-break-avoid mb-6 border border-stone-200 p-4 bg-stone-50/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
              Discharge Outcome & Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                  Outcome
                </span>
                <span className="font-bold text-stone-900">
                  {outcomeLabel}
                </span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                  Closing Summary
                </span>
                <p className="text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {data.closingSummary || "No closing summary provided."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* g) Footer line: "Report written by <Therapist name>, <Service>, <Branch>" and the print date. */}
        <div className="border-t-2 border-stone-900 pt-4 mt-8 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-600 gap-2">
          <span className="font-semibold text-stone-800">
            Report written by {data.therapistName}, {serviceLabel}, {data.branchName}
          </span>
          <span className="text-[11px] text-stone-500 font-mono">
            Printed: {data.printDate || formatDisplayDate(new Date().toISOString().slice(0, 10))}
          </span>
        </div>
      </div>

      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }

          body {
            background: white !important;
            color: #1c1917 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print,
          aside,
          header,
          nav {
            display: none !important;
          }

          .report-sheet {
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
          }

          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
