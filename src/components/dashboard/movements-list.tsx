"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { formatTimeIST } from "@/lib/date-utils";
import type { CaseMovementItem } from "@/lib/dashboard";

interface MovementsListProps {
  movements: CaseMovementItem[];
  onSelectCase: (movement: CaseMovementItem) => void;
}

export function MovementsList({ movements, onSelectCase }: MovementsListProps) {
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "new":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "assigned":
      case "accepted":
      case "in_progress":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "on_hold":
      case "pending":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "completed":
      case "discharged":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Icons.Clock className="h-4 w-4 text-[#0B7A63]" />
            <span>Case Progression & Lifecycle Movements</span>
          </h3>
          <p className="text-xs text-slate-500">
            Cases whose clinical status transitioned during this timeframe. Click any row to view its full audit history.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-600 rounded-[2px] bg-slate-100 px-2 py-0.5 border border-slate-200 tabular-nums">
          {movements.length} transition{movements.length !== 1 ? "s" : ""}
        </span>
      </div>

      {movements.length === 0 ? (
        <div className="rounded-none border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-slate-400">
          <Icons.FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-semibold text-slate-700">
            No case status transitions recorded
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            No cases changed status on this date.
          </p>
        </div>
      ) : (
        <div data-testid="movements-list" className="divide-y divide-slate-100 rounded-none border border-slate-200 bg-white overflow-hidden shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          {movements.map((m) => (
            <div
              key={m.id}
              data-testid="movement-row"
              onClick={() => onSelectCase(m)}
              className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/80 cursor-pointer transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-xs text-[#0B7A63]">
                    {m.caseNumber}
                  </span>
                  <PriorityBadge priority={m.priority} />
                  <span className="text-xs font-semibold text-slate-900">
                    {m.clientName}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate hidden md:inline">
                    &bull; {m.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Moved by <strong>{m.actorName}</strong> ({m.actorRole})</span>
                  {m.outcome && (
                    <span className="rounded-[2px] bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                      Outcome: {m.outcome}
                    </span>
                  )}
                  {m.notes && (
                    <span className="text-slate-500 truncate max-w-xs text-[11px]">
                      &ldquo;{m.notes}&rdquo;
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className={`rounded-[2px] border px-2 py-0.5 text-[11px] uppercase tracking-wider ${getStatusBadgeStyle(m.fromStatus)}`}>
                    {m.fromStatus}
                  </span>
                  <Icons.ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className={`rounded-[2px] border px-2 py-0.5 text-[11px] uppercase tracking-wider ${getStatusBadgeStyle(m.toStatus)}`}>
                    {m.toStatus}
                  </span>
                </div>

                <div className="text-right hidden sm:block">
                  <p className="font-mono text-xs font-bold text-slate-500 tabular-nums">
                    {formatTimeIST(m.occurredAt)}
                  </p>
                </div>

                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#0B7A63]">
                  <Icons.ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
