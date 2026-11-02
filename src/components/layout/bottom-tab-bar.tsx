"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/ui/icons";
import type { UserRole } from "@/db/schema";
import type { IconProps } from "@phosphor-icons/react";
import { getTherapistNotesAction } from "@/lib/actions/admin-notes-actions";

interface TabItem {
  label: string;
  href: string;
  icon: (props: IconProps) => React.ReactNode;
  badge?: number;
  testId?: string;
}

interface BottomTabBarProps {
  role: UserRole;
}

export function BottomTabBar({ role }: BottomTabBarProps) {
  const pathname = usePathname();
  const [unreadNotes, setUnreadNotes] = React.useState<number>(0);
  const [unreadAlerts, setUnreadAlerts] = React.useState<number>(0);

  const fetchCounts = React.useCallback(async () => {
    // Only poll when page is visible
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    if (role === "therapist") {
      try {
        const res = await getTherapistNotesAction();
        if (res.success && typeof res.unreadCount === "number") {
          setUnreadNotes(res.unreadCount);
        }
      } catch {
        // silent
      }
    } else {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === "number") {
            setUnreadAlerts(data.count);
          }
        }
      } catch {
        // silent
      }
    }
  }, [role]);

  React.useEffect(() => {
    fetchCounts();

    // Poll at most every 30 seconds
    const interval = setInterval(fetchCounts, 30000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchCounts();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [fetchCounts]);

  const getTabs = (): TabItem[] => {
    switch (role) {
      case "therapist":
        return [
          {
            label: "Today",
            href: "/therapist/dashboard",
            icon: Icons.Dashboard,
            testId: "tab-today",
          },
          {
            label: "Patients",
            href: "/therapist/cases",
            icon: Icons.Cases,
            testId: "tab-patients",
          },
          {
            label: "Notes",
            href: "/therapist/notes",
            icon: Icons.Envelope,
            badge: unreadNotes,
            testId: "tab-notes",
          },
          {
            label: "Profile",
            href: "/therapist/profile",
            icon: Icons.User,
            testId: "tab-profile",
          },
        ];
      case "admin":
        return [
          {
            label: "Dashboard",
            href: "/admin/dashboard",
            icon: Icons.Dashboard,
            testId: "tab-dashboard",
          },
          {
            label: "Therapists",
            href: "/admin/therapists",
            icon: Icons.Therapists,
            testId: "tab-therapists",
          },
          {
            label: "Rooms",
            href: "/admin/rooms",
            icon: Icons.Door,
            testId: "tab-rooms",
          },
          {
            label: "Cases",
            href: "/admin/cases",
            icon: Icons.Cases,
            testId: "tab-cases",
          },
          {
            label: "Alerts",
            href: "/notifications",
            icon: Icons.Bell,
            badge: unreadAlerts,
            testId: "tab-alerts",
          },
        ];
      case "super_admin":
        return [
          {
            label: "Dashboard",
            href: "/super-admin/dashboard",
            icon: Icons.Dashboard,
            testId: "tab-dashboard",
          },
          {
            label: "Branches",
            href: "/admin/branches",
            icon: Icons.Buildings,
            testId: "tab-branches",
          },
          {
            label: "Admins",
            href: "/super-admin/admins",
            icon: Icons.Admins,
            testId: "tab-admins",
          },
          {
            label: "Reports",
            href: "/super-admin/reports",
            icon: Icons.Reports,
            testId: "tab-reports",
          },
          {
            label: "More",
            href: "/super-admin/notifications",
            icon: Icons.More,
            badge: unreadAlerts,
            testId: "tab-more",
          },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();

  return (
    <nav
      data-testid="bottom-tab-bar"
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 w-full max-w-[480px] mx-auto border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] overscroll-contain select-none shadow-[0_-2px_8px_rgba(15,23,42,0.06)]"
    >
      <div className="flex h-16 w-full items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          // Determine if tab is active
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/super-admin/dashboard" &&
              tab.href !== "/admin/dashboard" &&
              tab.href !== "/therapist/dashboard" &&
              pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              data-testid={tab.testId}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center min-h-[48px] py-1.5 px-1 transition-colors duration-150 touch-manipulation select-none",
                isActive
                  ? "text-[#0B7A63] font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {/* Active Top Bar Indicator */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] bg-[#0B7A63]" />
              )}

              {/* Icon Container with Badge */}
              <div className="relative flex items-center justify-center">
                <Icon
                  size={22}
                  className={cn(
                    "transition-transform group-active:scale-95",
                    isActive ? "text-[#0B7A63]" : "text-slate-500"
                  )}
                />
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span
                    data-testid="unread-notes-badge"
                    className="absolute -top-1 -right-2 flex min-w-[16px] h-4 items-center justify-center px-1 text-[10px] font-bold text-white bg-rose-600 rounded-none leading-none shadow-xs"
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>

              {/* Tab Label (12px to 13px) */}
              <span className="mt-1 text-[12px] tracking-tight leading-tight truncate max-w-full text-center">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

