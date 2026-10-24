import * as React from "react";
import { Icons } from "@/components/ui/icons";
import type { DateFilterRange } from "@/lib/date-utils";

interface HistoryBannerProps {
  filter: DateFilterRange;
  hasActivity: boolean;
}

export function HistoryBanner({ filter, hasActivity }: HistoryBannerProps) {
  return (
    <div className="space-y-3">
      {/* 1. Past Date Read-Only Banner */}
      {filter.isPast && (
        <div
          data-testid="history-banner"
          className="flex items-center gap-3.5 rounded-none border border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-900 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-amber-100 text-amber-800 border border-amber-200">
            <Icons.Clock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-950 flex items-center gap-2">
              <span>Viewing history (read-only)</span>
              <span className="rounded-[2px] bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                Historical Record
              </span>
            </p>
            <p className="mt-0.5 text-amber-800 text-[12px]">
              You are examining clinical operations for{" "}
              <strong className="font-semibold text-amber-950">
                {filter.filterLabel}
              </strong>{" "}
              (Asia/Kolkata). New actions, status transitions, and note edits are disabled for past dates.
            </p>
          </div>
        </div>
      )}

      {/* 2. No Activity on this Date Banner */}
      {!hasActivity && (
        <div
          data-testid="no-activity-banner"
          className="flex items-center gap-3.5 rounded-none border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-slate-200 text-slate-600 border border-slate-300">
            <Icons.Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              No activity on this date
            </p>
            <p className="mt-0.5 text-slate-500 text-[12px]">
              No case events, appointments, notes, or movements were logged on{" "}
              <span className="font-semibold text-slate-700">{filter.filterLabel}</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
