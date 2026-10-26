"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon, FileText } from "lucide-react";
import { MonthCalendar, type CalendarSessionItem } from "@/components/cases/month-calendar";
import { CaseProgressReportTab } from "@/components/cases/case-progress-report-tab";
import type { ProgressReportItem } from "@/lib/actions/progress-report-actions";

interface CaseDetailTabContainerProps {
  caseId: string;
  patientId: string;
  startDate: string;
  closedAtDate: string | null;
  isClosed: boolean;
  isOwner: boolean;
  initialSessions: CalendarSessionItem[];
  initialReports: ProgressReportItem[];
  defaultTab?: "calendar" | "report";
}

export function CaseDetailTabContainer({
  caseId,
  patientId,
  startDate,
  closedAtDate,
  isClosed,
  isOwner,
  initialSessions,
  initialReports,
  defaultTab = "calendar",
}: CaseDetailTabContainerProps) {
  const [activeTab, setActiveTab] = useState<"calendar" | "report">(defaultTab);

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex border-b border-stone-200 bg-white">
        <button
          type="button"
          data-testid="tab-calendar"
          onClick={() => setActiveTab("calendar")}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 rounded-none cursor-pointer ${
            activeTab === "calendar"
              ? "border-[#0B7A63] text-[#0B7A63] bg-teal-50/20"
              : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Treatment Calendar</span>
        </button>

        <button
          type="button"
          data-testid="tab-progress-report"
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 rounded-none cursor-pointer ${
            activeTab === "report"
              ? "border-[#0B7A63] text-[#0B7A63] bg-teal-50/20"
              : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Progress Report</span>
          {initialReports.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-stone-100 text-stone-700 text-[10px] font-mono border border-stone-200">
              {initialReports.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "calendar" && (
        <div data-testid="calendar-tab-content">
          <MonthCalendar
            caseId={caseId}
            startDate={startDate}
            closedAtDate={closedAtDate}
            isClosed={isClosed}
            isReadOnly={isClosed}
            initialSessions={initialSessions}
          />
        </div>
      )}

      {activeTab === "report" && (
        <CaseProgressReportTab
          caseId={caseId}
          patientId={patientId}
          isOwner={isOwner}
          isClosed={isClosed}
          initialReports={initialReports}
        />
      )}
    </div>
  );
}
