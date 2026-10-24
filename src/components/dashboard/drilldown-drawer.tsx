"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { formatTimeIST } from "@/lib/date-utils";
import type { DrilldownActionItem } from "@/lib/dashboard";

export interface DrilldownTarget {
  title: string;
  subtitle?: string;
  dateStr: string; // formatted date label
  startDate: string;
  endDate: string;
  actorId?: string;
  caseId?: string;
  eventType?: string;
}

interface DrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  target: DrilldownTarget | null;
}

export function DrilldownDrawer({ isOpen, onClose, target }: DrilldownDrawerProps) {
  const [actions, setActions] = React.useState<DrilldownActionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchFilter, setSearchFilter] = React.useState("");

  React.useEffect(() => {
    if (!isOpen || !target) {
      setActions([]);
      return;
    }

    let isCancelled = false;
    async function fetchActions() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("from", target!.startDate);
        params.set("to", target!.endDate);
        if (target!.actorId) params.set("actorId", target!.actorId);
        if (target!.caseId) params.set("caseId", target!.caseId);
        if (target!.eventType) params.set("eventType", target!.eventType);

        const res = await fetch(`/api/dashboard/drilldown?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load actions (${res.status})`);
        }
        const json = await res.json();
        if (!isCancelled) {
          setActions(json.data || []);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "An unexpected error occurred");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchActions();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const filteredActions = actions.filter((act) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      act.eventType.toLowerCase().includes(q) ||
      act.actorName.toLowerCase().includes(q) ||
      (act.caseNumber && act.caseNumber.toLowerCase().includes(q)) ||
      (act.clientName && act.clientName.toLowerCase().includes(q))
    );
  });

  const getEventBadge = (type: string) => {
    switch (type) {
      case "case_created":
        return <Badge variant="neutral">Created</Badge>;
      case "case_assigned":
        return <Badge variant="info">Assigned</Badge>;
      case "case_accepted":
        return <Badge variant="info">Accepted</Badge>;
      case "case_declined":
        return <Badge variant="danger">Declined</Badge>;
      case "session_scheduled":
        return <Badge variant="info">Scheduled</Badge>;
      case "session_held":
        return <Badge variant="success">Held</Badge>;
      case "note_added":
        return <Badge variant="neutral">Note</Badge>;
      case "case_closed":
        return <Badge variant="success">Closed</Badge>;
      case "status_changed":
        return <Badge variant="warning">Status</Badge>;
      default:
        return <Badge variant="neutral">{type.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside
          data-testid="drilldown-drawer"
          className="w-screen max-w-md bg-white border-l border-slate-300 shadow-[0_12px_32px_rgba(15,23,42,0.16)] flex flex-col rounded-none animate-in slide-in-from-right duration-200"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-[#0B7A63] uppercase tracking-wider">
                  Audit Inspection Trail
                </span>
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight leading-snug">
                  {target.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {target.subtitle || `Events logged for ${target.dateStr}`}
                </p>
              </div>
              <button
                type="button"
                data-testid="drilldown-close-button"
                onClick={onClose}
                className="rounded-none p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <Icons.Close className="h-5 w-5" />
              </button>
            </div>

            {/* Quick search inside drawer */}
            <div className="mt-3 relative">
              <input
                type="text"
                placeholder="Filter actions by event, person, or case..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
              />
            </div>
          </div>

          {/* Drawer Body: Action List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            {isLoading && (
              <div className="space-y-3 py-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse p-4 rounded-none border border-slate-200 bg-slate-50 space-y-2">
                    <div className="h-4 bg-slate-200 rounded-none w-1/3" />
                    <div className="h-3 bg-slate-200 rounded-none w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-none border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
                <Icons.Alert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!isLoading && !error && filteredActions.length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Icons.Info className="h-8 w-8 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No actions found for this selection.</p>
                <p className="text-[11px] text-slate-400">
                  {searchFilter ? "Try clearing your search keyword." : "There were no raw events recorded in this timeframe."}
                </p>
              </div>
            )}

            {!isLoading &&
              filteredActions.map((act) => (
                <div
                  key={act.id}
                  data-testid="drilldown-item"
                  className="rounded-none border border-slate-200 bg-white p-3.5 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-slate-300 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getEventBadge(act.eventType)}
                      <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums">
                        {formatTimeIST(act.occurredAt)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                      Event #{act.id}
                    </span>
                  </div>

                  {/* Actor details */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Icons.UserSingle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-900">{act.actorName}</span>
                    <span className="text-slate-400">({act.actorRole})</span>
                  </div>

                  {/* Case / Client association */}
                  {act.caseNumber && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <Icons.Cases className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono font-semibold text-[#0B7A63]">
                        {act.caseNumber}
                      </span>
                      {act.clientName && (
                        <span className="text-slate-500 truncate">&bull; {act.clientName}</span>
                      )}
                    </div>
                  )}

                  {/* Status movement if present */}
                  {act.fromStatus && act.toStatus && act.fromStatus !== act.toStatus && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium pt-1 text-slate-600">
                      <span className="rounded-[2px] bg-slate-100 px-1.5 py-0.5 text-slate-700 border border-slate-200">
                        {act.fromStatus}
                      </span>
                      <Icons.ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="rounded-[2px] bg-[#0B7A63]/10 px-1.5 py-0.5 text-[#0B7A63] border border-[#0B7A63]/30 font-semibold">
                        {act.toStatus}
                      </span>
                    </div>
                  )}

                  {/* Metadata notes / outcome */}
                  {act.metadata && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-none border border-slate-100 font-sans">
                      {typeof (act.metadata as any)?.notes === "string"
                        ? (act.metadata as any).notes
                        : typeof (act.metadata as any)?.noteSnippet === "string"
                        ? (act.metadata as any).noteSnippet
                        : JSON.stringify(act.metadata)}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
            <span className="tabular-nums">
              Showing <strong className="text-slate-900">{filteredActions.length}</strong> of {actions.length} events
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-[#0B7A63] hover:underline"
            >
              Done
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
