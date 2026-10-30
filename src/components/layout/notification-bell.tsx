"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { OutcomeTag } from "@/components/notifications/outcome-tag";
import {
  getLatestNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  pollNotificationsAction,
} from "@/lib/actions/notification-actions";
import type { InAppNotification } from "@/db/schema";

interface NotificationBellProps {
  userRole?: string;
}

export function NotificationBell({ userRole = "admin" }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    title: string;
    body: string;
    caseId?: string | null;
  } | null>(null);

  const lastCheckedRef = React.useRef<string>(new Date().toISOString());
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load initial notifications
  const loadNotifications = React.useCallback(async () => {
    try {
      const res = await getLatestNotificationsAction();
      if (res.success && res.data) {
        setNotifications(res.data.notifications as InAppNotification[]);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Ignore background errors
    }
  }, []);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 20-second polling while tab is visible
  React.useEffect(() => {
    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await pollNotificationsAction({ since: lastCheckedRef.current });
        if (res.success) {
          setUnreadCount(res.unreadCount);
          if (res.timestamp) {
            lastCheckedRef.current = res.timestamp;
          }

          if (res.newClosedCases && res.newClosedCases.length > 0) {
            const latestClosed = res.newClosedCases[0];
            setToast({
              title: latestClosed.title,
              body: latestClosed.body,
              caseId: latestClosed.caseId,
            });

            // Auto dismiss toast after 6 seconds
            setTimeout(() => {
              setToast((curr) => (curr?.title === latestClosed.title ? null : curr));
            }, 6000);

            // Refresh list
            loadNotifications();
          }
        }
      } catch {
        // Suppress poll errors
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      await markAllNotificationsReadAction();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.isRead) {
      markNotificationReadAction(notif.id).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }
    setIsOpen(false);

    if (notif.caseId) {
      const basePath = userRole === "super_admin" ? "/super-admin" : "/admin";
      router.push(`${basePath}/cases/${notif.caseId}`);
    } else {
      router.push("/notifications");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toast popup for newly arrived closed cases */}
      {toast && (
        <div
          data-testid="closed-case-toast"
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm bg-slate-900 text-white p-3.5 border-l-4 border-[#0B7A63] shadow-xl flex items-start gap-3 rounded-none animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="p-1 bg-emerald-500/20 text-emerald-400 shrink-0">
            <Icons.Check className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white tracking-wide">{toast.title}</p>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{toast.body}</p>
            {toast.caseId && (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  const basePath = userRole === "super_admin" ? "/super-admin" : "/admin";
                  router.push(`${basePath}/cases/${toast.caseId}`);
                }}
                className="mt-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
              >
                View case &rarr;
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white shrink-0"
          >
            <Icons.X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bell Button */}
      <button
        type="button"
        data-testid="notification-bell-btn"
        aria-label="View notifications"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-none border border-slate-300 text-slate-600 hover:text-[#0B7A63] hover:border-[#0B7A63] hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <Icons.Alert className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-none bg-[#0B7A63] text-white text-[10px] font-bold flex items-center justify-center ring-1 ring-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-none bg-white border border-slate-200 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#0B7A63]/10 text-[#0B7A63] text-[10px] font-bold rounded-none">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  data-testid="mark-all-read-btn"
                  onClick={handleMarkAllRead}
                  disabled={isLoading}
                  className="text-[11px] font-medium text-slate-500 hover:text-[#0B7A63] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => {
                const isClosedCase = notif.type === "case_closed";
                const outcome = (notif.data as any)?.outcome;

                return (
                  <div
                    key={notif.id}
                    data-testid={`notification-item-${notif.id}`}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 flex items-start gap-2.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                      !notif.isRead ? "bg-emerald-50/20" : ""
                    }`}
                  >
                    {/* Icon Tile */}
                    {isClosedCase ? (
                      <div className="h-8 w-8 rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Icons.Check className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-none bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Icons.Info className="h-4 w-4" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="h-1.5 w-1.5 rounded-none bg-[#0B7A63] shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                        {notif.body}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        {outcome && <OutcomeTag outcome={outcome} size="sm" />}
                        <span className="text-[10px] text-slate-400">
                          {new Date(notif.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-[#0B7A63] hover:text-[#096350] hover:underline"
            >
              View all notifications &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
