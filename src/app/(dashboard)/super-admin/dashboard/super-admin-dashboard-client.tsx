"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HistoryBanner } from "@/components/dashboard/history-banner";
import {
  RecentlyClosedCasesCard,
  type ClosedCaseItem,
} from "@/components/dashboard/recently-closed-cases-card";
import type { CurrentUser } from "@/lib/session";
import { formatDisplayDate } from "@/lib/date-utils";

interface SuperAdminDashboardClientProps {
  user: CurrentUser;
  selectedDate: string;
  isPast: boolean;
  isToday: boolean;
  branchName: string;
  recentlyClosedCases: ClosedCaseItem[];
}

export function SuperAdminDashboardClient({
  user,
  selectedDate,
  isPast,
  isToday,
  branchName,
  recentlyClosedCases,
}: SuperAdminDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const sp = new URLSearchParams(searchParams ? searchParams.toString() : "");
      sp.set("date", val);
      sp.delete("from");
      sp.delete("to");
      router.push(`/super-admin/dashboard?${sp.toString()}`);
    }
  };

  const filter = {
    startDate: selectedDate,
    endDate: selectedDate,
    isPast,
    isToday,
    isRange: false,
    filterLabel: formatDisplayDate(selectedDate),
    presetKey: isToday ? ("today" as const) : ("custom_date" as const),
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Single Date Picker at Top */}
      <div className="rounded-none border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B7A63]">
                Super Admin Portal
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-xs font-semibold text-slate-700">{branchName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <label
              htmlFor="dashboard-date"
              className="text-xs font-semibold uppercase tracking-wider text-slate-600 sm:sr-only"
            >
              Select Date
            </label>
            <input
              id="dashboard-date"
              type="date"
              data-testid="super-admin-date-picker"
              value={selectedDate}
              onChange={handleDateChange}
              className="w-full sm:w-auto min-h-[48px] rounded-none border border-slate-300 bg-white px-3.5 py-2.5 text-base font-medium text-slate-900 focus:outline-none focus:border-[#0B7A63]"
            />
          </div>
        </div>
      </div>

      {/* Read-Only History Note for Past Dates */}
      {isPast && (
        <HistoryBanner filter={filter} hasActivity={recentlyClosedCases.length > 0} />
      )}

      {/* 2. Recently Closed Cases Section */}
      <RecentlyClosedCasesCard
        cases={recentlyClosedCases}
        userRole="super_admin"
      />
    </div>
  );
}
