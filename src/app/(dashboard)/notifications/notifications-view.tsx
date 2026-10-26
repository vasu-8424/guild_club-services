"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { OutcomeTag } from "@/components/notifications/outcome-tag";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notification-actions";
import type { InAppNotification } from "@/db/schema";
import type { CurrentUser } from "@/lib/session";

interface NotificationsViewProps {
  user: CurrentUser;
}

export function NotificationsView({ user }: NotificationsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = React.useState<"all" | "unread" | "closed_cases">(
    (searchParams.get("tab") as any) || "all"
  );
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState<number>(1);

  const [items, setItems] = React.useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNotificationsAction({
        tab,
        type: typeFilter,
        outcome: outcomeFilter,
        page,
        pageSize: 10,
      });

      if (res.success && res.data) {
        setItems(res.data.items as InAppNotification[]);
        setUnreadCount(res.data.unreadCount);
        setTotalCount(res.data.totalCount);
        setTotalPages(res.data.totalPages);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tab, typeFilter, outcomeFilter, page]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadAction();
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      // Ignore
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await markNotificationReadAction(id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch {
      // Ignore
    }
  };

  const getCaseUrl = (caseId?: string | null) => {
    if (!caseId) return "#";
    const basePath = user.role === "super_admin" ? "/super-admin" : "/admin";
    return `${basePath}/cases/${caseId}`;
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                data-testid="unread-count-badge"
                className="px-2 py-0.5 bg-[#0B7A63] text-white text-xs font-bold rounded-none"
              >
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Stay updated on closed cases, completed clinical sessions, and system activities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              data-testid="mark-all-notifications-read"
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              className="rounded-none border-slate-300 text-slate-700 hover:text-[#0B7A63]"
            >
              <Icons.Check className="mr-1.5 h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            data-testid="tab-all"
            onClick={() => {
              setTab("all");
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              tab === "all"
                ? "border-[#0B7A63] text-[#0B7A63]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            All
          </button>
          <button
            type="button"
            data-testid="tab-unread"
            onClick={() => {
              setTab("unread");
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              tab === "unread"
                ? "border-[#0B7A63] text-[#0B7A63]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            data-testid="tab-closed-cases"
            onClick={() => {
              setTab("closed_cases");
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              tab === "closed_cases"
                ? "border-[#0B7A63] text-[#0B7A63]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Closed Cases
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Type:</label>
            <select
              data-testid="filter-type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-300 rounded-none bg-white px-2.5 py-1.5 text-slate-800 focus:border-[#0B7A63] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="case_closed">Case Closed</option>
              <option value="session_completed_group">Session Completed</option>
              <option value="admin_account_created">Account Created</option>
              <option value="welcome">Welcome</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Outcome:</label>
            <select
              data-testid="filter-outcome"
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-300 rounded-none bg-white px-2.5 py-1.5 text-slate-800 focus:border-[#0B7A63] focus:outline-none"
            >
              <option value="all">All Outcomes</option>
              <option value="successful">Successful</option>
              <option value="unsuccessful">Unsuccessful</option>
              <option value="referred">Referred</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white border border-slate-200">
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white border border-slate-200">
            No notifications match your current view.
          </div>
        ) : (
          items.map((item) => {
            const isClosedCase = item.type === "case_closed";
            const outcome = (item.data as any)?.outcome;
            const closedAtIst = (item.data as any)?.closedAt;
            const sessionsHeld = (item.data as any)?.sessionsHeld;
            const isUnsuccessful = outcome?.toLowerCase() === "unsuccessful";

            return (
              <div
                key={item.id}
                data-testid={`notification-card-${item.id}`}
                className={`p-4 border rounded-none transition-all ${
                  !item.isRead
                    ? "bg-white border-[#0B7A63]/40 shadow-xs"
                    : "bg-white/80 border-slate-200"
                } ${isUnsuccessful ? "border-l-4 border-l-rose-500" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Icon Tile */}
                    {isClosedCase ? (
                      <div className="h-10 w-10 rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                        <Icons.Check className="h-5 w-5" />
                      </div>
                    ) : item.type === "session_completed_group" ? (
                      <div className="h-10 w-10 rounded-none bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                        <Icons.Clock className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-none bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                        <Icons.Info className="h-5 w-5" />
                      </div>
                    )}

                    {/* Content Details */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          {item.title}
                        </h3>
                        {outcome && <OutcomeTag outcome={outcome} size="sm" />}
                        {item.priority === "high" && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-none uppercase">
                            High Priority
                          </span>
                        )}
                        {!item.isRead && (
                          <span className="px-1.5 py-0.2 bg-[#0B7A63]/10 text-[#0B7A63] text-[10px] font-bold rounded-none">
                            Unread
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.body}
                      </p>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-400">
                        {closedAtIst && (
                          <span>
                            Closed at: <strong className="text-slate-600 font-medium">{closedAtIst}</strong>
                          </span>
                        )}
                        {sessionsHeld !== undefined && (
                          <span>
                            Sessions held: <strong className="text-slate-600 font-medium">{sessionsHeld}</strong>
                          </span>
                        )}
                        <span>
                          {new Date(item.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-2 sm:pt-0">
                    {!item.isRead && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMarkOneRead(item.id)}
                        className="rounded-none text-xs text-slate-600 hover:text-slate-900"
                      >
                        Mark as read
                      </Button>
                    )}

                    {item.caseId && (
                      <Link href={getCaseUrl(item.caseId)}>
                        <Button
                          data-testid={`view-case-btn-${item.id}`}
                          variant="primary"
                          size="sm"
                          className="rounded-none bg-[#0B7A63] hover:bg-[#096350] text-xs"
                        >
                          View case &rarr;
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Showing page <strong className="text-slate-800">{page}</strong> of{" "}
            <strong className="text-slate-800">{totalPages}</strong> ({totalCount} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              data-testid="pagination-prev"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-none"
            >
              Previous
            </Button>
            <Button
              data-testid="pagination-next"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-none"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
