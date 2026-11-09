"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { DateSelector } from "@/components/dashboard/date-selector";
import { HistoryBanner } from "@/components/dashboard/history-banner";
import { BranchReportButton } from "@/components/admin/branch-report-button";
import { AdminReasonInbox } from "@/components/admin/admin-reason-inbox";
import type { AdminDashboardData } from "@/lib/dashboard-admin";

interface AdminDashboardClientProps {
  data: AdminDashboardData;
}

export function AdminDashboardClient({ data }: AdminDashboardClientProps) {
  const router = useRouter();
  const { stats, filter } = data;

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Date Selector */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Icons.Info className="h-4 w-4 text-[#0B7A63] shrink-0" />
          <span>Clinical overview for <strong className="text-slate-800 font-semibold">{filter.filterLabel}</strong> (Asia/Kolkata).</span>
        </p>
        <div className="flex flex-col gap-2 w-full">
          <BranchReportButton />
          <div data-testid="dashboard-date-selector" className="w-full">
            <DateSelector />
          </div>
        </div>
      </div>

      {/* Historical past date read-only banner */}
      <HistoryBanner filter={filter} hasActivity={true} />

      {/* Metric Stat Tiles (Rooms tile removed for Admin) */}
      <div className="grid grid-cols-2 gap-3">
        {/* 1. Therapists (active) */}
        <div
          data-testid="stat-therapists"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none"
        >
          <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-600">
            Therapists (active)
          </p>
          <p className="text-[28px] font-bold font-mono text-slate-900 mt-2">
            {stats.activeTherapists}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Practitioners on duty</p>
        </div>

        {/* 2. Active cases */}
        <div
          data-testid="stat-active-cases"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none"
        >
          <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-600">
            Active cases
          </p>
          <p className="text-[28px] font-bold font-mono text-slate-900 mt-2">
            {stats.activeCases}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {filter.isPast ? "Active on this date" : "Current open treatments"}
          </p>
        </div>

        {/* 3. Sessions on selected date */}
        <div
          data-testid="stat-sessions"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none col-span-2 sm:col-span-1"
        >
          <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-600">
            Sessions on date
          </p>
          <p className="text-[28px] font-bold font-mono text-[#0B7A63] mt-2">
            {stats.sessionsOnDate}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Recorded for {filter.filterLabel}</p>
        </div>
      </div>

      {/* Session Reasons Today Inbox Card */}
      <AdminReasonInbox
        selectedDate={filter.startDate}
        onRefreshNeeded={() => router.refresh()}
      />
    </div>
  );
}
